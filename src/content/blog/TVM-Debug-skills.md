---
title: 'TVM Debugging skills'
description: 'TVM Debugging skills' 
pubDate: 'Mar 1 2026'
tags: [TVM]
---

### 一些调试时有用的技巧

`sch.get(block_b).name_hint` 用于获得某个`block`的`name_hint`, 也就是`sch.mod.show()`

中`block`的名字。

`sch.get(i).loop_var`获得某个循环变量在`sch.mod.show()`中的名字，在循环变量特别多时，便于调试。

```python
@tvm.script.ir_module
class GEMM:
    @T.prim_func
    def main(a: T.handle, b: T.handle, c: T.handle):
        T.func_attr({"global_symbol": "main", "tir.noalias": True})
        A = T.match_buffer(a, (M, K), dtype=dtype)
        B = T.match_buffer(b, (K, N), dtype=dtype)
        C = T.match_buffer(c, (M, N), dtype=dtype)
        for i, j, k in T.grid(M, N, K):
            with T.block("C"):
                vi, vj, vk = T.axis.remap("SSR", [i, j, k])
                with T.init():
                    C[vi, vj] = 0.0
                C[vi, vj] = C[vi, vj] + A[vi, vk] * B[vk, vj]

mod = GEMM
sch = tvm.tir.Schedule(mod)
block_C = sch.get_block("C")
print(sch.get(block_C).name_hint) # C
ax0,ax1,ax2 = sch.get_loops(block_C)
print(sch.get(ax0).loop_var) # i
```



### Error message: The block tir.Block#0 is an output block

```python
@tvm.script.ir_module
class GEMM:
    @T.prim_func
    def main(a: T.handle, b: T.handle, c: T.handle):
        T.func_attr({"global_symbol": "main", "tir.noalias": True})
        A = T.match_buffer(a, (M, K), dtype=dtype)
        B = T.match_buffer(b, (K, N), dtype=dtype)
        C = T.match_buffer(c, (M, N), dtype=dtype)
        for i, j, k in T.grid(M, N, K):
            with T.block("C"):
                vi, vj, vk = T.axis.remap("SSR", [i, j, k])
                with T.init():
                    C[vi, vj] = 0.0
                C[vi, vj] = C[vi, vj] + A[vi, vk] * B[vk, vj]

mod = GEMM
sch = tvm.tir.Schedule(mod)
block_C = sch.get_block("C")
block_C_cache = sch.cache_write(block_C, 0, "local")
i, j, k = sch.get_loops(block_C)
# Error message: The block tir.Block#0 is an output block
sch.compute_at(block_C_cache, j)
sch.mod.show()
```

当我尝试将移动一个`block`的位置时，有时会遇到报错`Error message: The block tir.Block#0 is an output block`。这个报错的意思应该是：当前要移动的`block`是一个`output block`，也就是说当前的`tir.prim_func`的计算结果是通过这个`block`输出的，不能移动一个`output block`。

可以用以下两种方式去绕开：

* `reverse_compute_at`

  反方向移动，本质是将`block_C`移动到`block_C_cache`里面

  ```python
  sch.reverse_compute_at(block_C_cache, j)
  ```

* 手动实现`reverse_compute_at`

  ```python
  block_C = sch.get_block("C")
  block_C_cache = sch.cache_write(block_C, 0, "local")
  i, j = sch.get_loops(block_C_cache)
  sch.compute_at(block_C, j)
  ```

  