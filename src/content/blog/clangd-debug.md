---
title: 'A Painful clangd Debugging Experience'
description: '一次痛苦的clangd调试经历'
pubDate: 'Nov 1 2025'
tags: [Debug]
---

因为dataflow code style要从LLVM style迁移到Google style(也许与Dr. Tan工作相关)，我负责了这个pr。但其中因为clangd与clang-format版本不兼容，导致我坐牢了一晚上。

首先，需要从`clang-format` dump the `.clang-format` file of Google style:

```shell
clang-format --style=Google --dump-config > .clang-format
```

按理来说，此时VSCode extension `clangd`应该能够自动检测到`.clang-format`并在`Alt+Shift+f`后自动将代码格式化成Google style。但clangd仍然使用的是LLVM style，也就是说`.clang-format`无效或没被识别到。于是我就开始了漫长的与LLM battle的时间。

LLM问不出个所以然，于是自己冷静下来，开始溯源:

1. 检查快捷键`Alt+Shift+f`触发的formatter到底是哪一个，Microsoft C_Cpp or Clangd? 我确保了setting 中`C_Cpp: Formatting` is disabled, `clangd` is enabled.  

2. 按下`Alt+Shift+f`快捷键后，到底发生了什么，clangd有没有读取项目根目录下的`.clang-format`。这时我突然想到之前在读TVM源码时，clangd总是报错崩溃，终端是可以看到error message的。

   我们可以在setting `Clangd: Arguments`中Add Item `-log=verbose`, 切换到cpp文件按一次快捷键，查看Output输出的内容(可以选择只查看clangd的message)：

   ![image-20260127222329574](images/clangd-debug.png)

​       发现：

```
I[21:40:07.268] <-- textDocument/formatting(10)
/home/benkangpeng/github/dataflow/.clang-format:11:3: error: unknown key 'AlignFunctionDeclarations'
  AlignFunctionDeclarations: false
  ^~~~~~~~~~~~~~~~~~~~~~~~~
I[21:40:07.271] getStyle() failed for file /home/benkangpeng/github/dataflow/tools/neura-compiler/neura-compiler.cpp: Error reading /home/benkangpeng/github/dataflow/.clang-format: Invalid argument. Fallback is LLVM style.
```

clangd无法识别`AlignFunctionDeclarations`这个关键词。`.clang-format`是用clang-format生成的，应该不会有错误，所以原因很明显了，clangd与clang-format版本不兼容。经查看，clangd是17.0，而clang-format是20.1.7。将clangd的版本升级一下即可，我使用的是clangd 21.1.0.

值得注意的是，生成的`.clang-format`中`DerivePointerAlignment: true`，这意味着，如果你的代码指针是Right Alignment，clangd并不会将其改成Left Alignment，它会自动推断用户的偏好。即，`int *p;`不会被修改成`int* p;`, 但会保持`int *p;`



教训：遇到这种实操型的bug，LLM一般难以解决，一定要自己先冷静下来，制定清晰的排错方法，逐步追踪溯源。不要陷入了与LLM battle的困境(也可以让LLM给出可行的实操排错方案)。

