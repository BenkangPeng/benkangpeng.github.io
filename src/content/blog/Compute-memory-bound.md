---
title: 'Compute bound and Memory bound'
description: 'Compute bound and Memory bound'
pubDate: 'Jul 3 2025'
tags: [Cuda]
---
之前一直对算子是`compute bound` or `memory bound`区分不清楚，今天学习了一下，记录如下。

定义：$N_{op}$为一个算子的计算量，$N_{byte}$为一个算子需要访问的数据量。$BW_{compute}$为硬件的计算速度，单位为FLOPS，$BW_{mem}$表示硬件的访存带宽，这两个指标都是硬件的固有属性，例如A100的计算带宽$BW_{compute} = 19.5TFLOPS$ , 访存带宽$BW_{mem} = 1.6TB/sec$ .

定义计算时间             $t_{compute} = \frac{N_{op}}{BW_{compute}}$

访问内存时间            $t_{mem} = \frac{N_{byte}}{BW_{mem}}$

当$t_{compute} > t_{mem}$ 时， 算子是`compute bound`, 算子性能受限于硬件的计算速率；

当$t_{compute} < t_{mem}$ 时， 算子是`memory bound`, 算子性能受限于硬件的访存速率；

做一个简单变化：

$\frac{N_{op}}{N_{byte}} > \frac{BW_{compute}}{BW_{mem}}$  --> compute bound

$\frac{N_{op}}{N_{byte}} < \frac{BW_{compute}}{BW_{mem}}$  --> memory bound

在roofline模型中，$\frac{N_{op}}{N_{byte}}$称作计算强度(compute intensity)

常见的`compute bound`的算子：GEMM, FFT, Convolution

常见的`memory bound`的算子：Element-wise, relu

GEMM是计算密集(计算受限)的算子。这似乎有些反认知，因为我们写cuda时，总是在调优它的分块、预取，以提高访存命中。但调优策略与性能瓶颈并不一致。在优化GEMM时，我们很难去减少$N_{op}$(除非换矩阵乘法的算法)，但能够通过cache，分块策略去减小对global memory的访问量$N_{byte}$

 一个Native GEMM算子中，$N_{byte}$存在很大的优化空间，因此大多数优化都集中于此。当存储上的优化做到极致时，此时GEMM才遇到其真正的性能瓶颈(硬件计算速度)。