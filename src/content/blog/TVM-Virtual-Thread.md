---
title: 'TVM Virtual Thread'
description: 'TVM Virtual Thread' 
pubDate: 'Aug 23 2026'
tags: [TVM]
---

对TVM的Virtual Thread一直很疑惑。最近看到相关教程将`vthread`对应于`cuda warp tiling`的优化，于是做了一些实验。仍然没有得到准确的结论(如果有大佬看到，希望能指点一下)，本文只是做一个记录。

`Warp`是GPU线程调度的基本单元：GPU以Warp(一般为32个线程)为单位执行指令。可以认为同一个Warp中的32个线程**严格**同时执行指令。一个threadblock中threadIdx.x连续的32个线程通常属于一个Warp(以threadIdx.x划分Warp)。

合并访存：当Warp中32个线程都在执行一条`load`指令时，如果它们要访问的内存地址是连续的，那么GPU的内存控制器可以将这些访问请求合并成一次(或多次)大的内存事务(例如，一次128字节的内存访问事务)，这能够提高内存访问的效率。

但我做实验没见相邻的线程(相邻的threadIdx.x)访问相邻的(连续的)内存地址。

[🔗code](https://gist.github.com/BenkangPeng/b24adafebddb3ba0a6465a96dbd37bcc#file-code3-1_test_warp_tiling-py)

```
(tvm-build-venv) $ # tvm version: v0.20.0
(tvm-build-venv) $ python Code3.1_test_warp_tiling.py
```

> Time cost without vthread: 0.386048 ms
> Time cost with vthread: 0.314368 ms
> Execution time decreases: 18.567639257294434%

有可观的收益

对应的`IRModule`以及`cuda` 见[🔗Gist](https://gist.github.com/BenkangPeng/b24adafebddb3ba0a6465a96dbd37bcc)

> 在thread tiling的基础上加上vthread binding,有~2%的收益。

`Code3.1_test_warp_tiling_with_vthread.cu`相较于`Code3.1_test_warp_tiling_without_vthread.cu`也只是将循环展开成了64行代码。两份代码中，对A的访问，与`threadIdx.x`相关的一项都是`threadIdx.x * 32768` ； 对B的写入，与`threadIdx.x`相关的一项都是`threadIdx.x * 8` 。这意味着同一个Warp中相邻的线程，对A的访问间隔地址为`32768`，对B写入的间隔地址为`8`，均无法有效地做到内存事务合并。但是使用`vthread`的IRModule性能就是高了18%.

我考虑用`unroll`做循环展开，这样生成的cuda代码"应该"与`vthread`的版本相同了：

[🔗对应的Schedule代码](https://gist.github.com/BenkangPeng/b24adafebddb3ba0a6465a96dbd37bcc#file-code3-1_test_warp_tiling_with_unroll-py)

[🔗IRModule](https://gist.github.com/BenkangPeng/b24adafebddb3ba0a6465a96dbd37bcc#file-code3-1_unroll-py)

[🔗Cuda](https://gist.github.com/BenkangPeng/b24adafebddb3ba0a6465a96dbd37bcc#file-code3-1_unroll-cu)

对比[Code3.1_test_warp_tiling_with_vthread.cu](https://gist.github.com/BenkangPeng/b24adafebddb3ba0a6465a96dbd37bcc#file-code3-1_test_warp_tiling_with_vthread-cu)  和[Code3.1_unroll.cu](https://gist.github.com/BenkangPeng/b24adafebddb3ba0a6465a96dbd37bcc#file-code3-1_unroll-cu)  , 关于`blockIdx.y` `blockIdx.x` `threadIdx.y` `threadIdx.x`的计算都是相同的，唯一不同的就是指令的展开顺序，这也是`18%`的性能差距的来源。

**`Code3.1_unroll.cu`的内存访问模式：**

* **对A的读取**：连续的8次(8条指令)读取访问的地址间隔为4096（`+0, +4096, +8192, ...`）
* **对B的写入**：连续的8次写入访问连续的地址（`+0, +1, +2, ...`）

这导致：

- **A矩阵读取**：严重不连续，跨行访问，cache利用率低
- **B矩阵写入**：连续访问，cache友好

###  vthread.cu的内存访问模式

- **对A的读取**：连续的8次读取访问连续的地址（`+0, +1, +2, ...`）
- **对B的写入**：连续的8次写入访问的地址间隔为4096（`+0, +4096, +8192, ...`）

这导致：

- **A矩阵读取**：连续访问，cache友好
- **B矩阵写入**：跨行访问，cache不友好

个人观点(猜测)：

**`vthread.cu`性能更高的关键原因**：

1. **读取操作的连续性更重要**
   - **GPU的读取带宽通常比写入带宽更关键**
   - 连续的读取模式可以充分利用cache line
   - 不连续的读取会产生更多cache miss，严重影响性能
2. **写入合并的影响**
   - 虽然`vthread.cu`的写入`B`的模式不好，但读`A`能够指令间复用cache数据，且读数据时复用更重要。
   - 但现代GPU对不连续写入有一定程度的合并写入优化
   - 读取的不连续性对性能影响更大

直到这里我仍然没看到`vthread`带来的**同一个warp中不同thread复用数据** 的收益，换句话说，`vthread.cu`带来的性能收益在于**同一个thread不同指令之间的复用**。

So, warp tiling到底是啥，为什么vthread与warp tiling有关……
