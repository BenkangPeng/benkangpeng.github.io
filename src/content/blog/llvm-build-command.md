---
title: 'LLVM build notes'
description: 'LLVM build notes'
pubDate: 'Dec 11 2025'
tags: [LLVM]
---

```shell
$ mkdir build
$ cmake -S ../llvm -G Ninja -DLLVM_ENABLE_PROJECTS="clang;lld;mlir;clang-tools-extra;lldb;polly;cross-project-tests" -DCMAKE_BUILD_TYPE=Release -DLLVM_ENABLE_ASSERTIONS=ON -DLLVM_BUILD_EXAMPLES=ON -DLLVM_TARGETS_TO_BUILD="Native;ARM;AArch64" -DCMAKE_C_COMPILER=gcc -DCMAKE_CXX_COMPILER=g++ -DLLVM_TEMPORARILY_ALLOW_OLD_TOOLCHAIN=ON
$ cmake --build . -j #或者使用ninja
```

* `-DCMAKE_BUILD_TYPE`可以换成`Debug`，但这样编译更慢、生成的文件更大
* `-DLLVM_TARGETS_TO_BUILD`指定要构建的目标架构代码生成器。
* `-DLLDB_TEST_COMPILER=/opt/rh/devtoolset-9/root/usr/bin/g++`   `-DCMAKE_INSTALL_PREFIX=`增加这两个选项可以将`clang;lldb`等工具安装到指定目录。安装的命令：`ninja` , `ninja install`

将`LLVM bin`目录添加到`PATH`

在`bashrc`中添加：

```
export LLVM_BUILD_DIR=/home/pengbenkang/github/LLVM/build
export PATH=$PATH:$LLVM_BUILD_DIR/bin
```

这样才能找到`llvm`的`package`,例如以下两条`cmake`命令:

```cmake
find_package(MLIR REQUIRED CONFIG)
find_package(LLVM REQUIRED CONFIG)
```



### LLVM最小构建

最近在构建基于TVM的一些论文Artifact时(例如[Ansor-AF-DS](https://github.com/HPCRL/tvm/tree/main?tab=readme-ov-file)), 编译这个定制版的TVM时总会爆LLVM的错误。原因是LLVM的一些API变动，TVM与LLVM版本没匹配上。可以在TVM整个代码库中搜索`LLVM`，可以在`NEWS` `CHANGELOG`等文件中发现适配的LLVM版本，安装即可。

但是使用`conda`等包管理工具安装LLVM后，编译TVM仍然会爆LLVM的错。因此只能选择从源码构建一个LLVM。可以在`llvm-project release`中下载一个源码压缩包，例如`llvm-11.0.0.src.tar.xz`。只需要使用以下命令，构建最小的`llvm`即可(~1.6G):

```shell
$ cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=MinSizeRel
$ cd build/
$ ninja
```

再将`tvm/build`中的`config.cmake` `llvm-config` 指向

```
set(USE_LLVM "/path/to/llvm-11/build/bin/llvm-config --ignore-libllvm --link-static")
```
