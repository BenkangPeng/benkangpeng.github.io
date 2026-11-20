---
title: 'Cuda VSCode config'
description: 'Cuda在VSCode上的配置'
pubDate: 'May 18 2025'
tags: [Cuda]
---

**tasks.json**

```json
{
    "tasks": [
        {
            "label": "Cuda C++ Build",
            "command": "nvcc",
            "args": [
                "-g",
                "-O0",
                "${file}",
                "-o",
                "${fileDirname}/bin/${fileBasenameNoExtension}",
                // change to your own GPU architecture
                "--gpu-architecture=compute_89"
            ]
        }
    ],
    "version": "2.0.0"
}
```

**launch.json**

```json
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "name": "CUDA C++: Launch",
            "type": "cuda-gdb",
            "request": "launch",
            "program": "${fileDirname}/bin/${fileBasenameNoExtension}",
            "preLaunchTask": "Cuda C++ Build"
        },
    ]
}
```

**Clangd Config(.clangd)**

```json
CompileFlags:
  Add:
    - "-x"
    - "cuda"
    - "--cuda-path=/usr/local/cuda-12.4"
    - "--cuda-gpu-arch=sm_89"
    - "-I/usr/local/cuda-12.4/include"
    - "-D__CUDACC__"
    - "-D__NVCC__"
  Remove:
    - "-forward-unknown-to-host-compiler"
    - "--options-file"
    - "--generate-code*"

Diagnostics:
  UnusedIncludes: None
  MissingIncludes: None
  Suppress:
    - "variadic_device_fn"
    - "attributes_not_allowed"
```

