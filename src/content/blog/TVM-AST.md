---
title: 'TVM AST Notes'
description: 'TVM AST Notes'
pubDate: 'May 12 2026'
tags: [TVM]
---

> 这篇blog分析TVM前端语法树的构建机制

TVM在生成AST时，使用了Python官方库`ast`，同时为了保证兼容性(后文会提到)，在`ast`的基础上实现了一个`doc.AST`，将`ast.AST`转换为TVM自己实现的`doc.AST`.

`core/doc.py`

```python
def parse(
    source: str,
    filename: str = "<unknown>",
    mode: str = "exec",
) -> doc.AST:
   try:
        program = ast.parse(  # pylint: disable=unexpected-keyword-arg
            source=source,
            filename=filename,
            mode=mode,
            feature_version=(3, 8),
        )
    except:  # pylint: disable=bare-except
        program = ast.parse(
            source=source,
            filename=filename,
            mode=mode,
        )
    return to_doc(program) 
```

先使用`ast.parse`解析得到语法树`program`，再将`ast.AST`通过`to_doc`转成`doc.AST`

### `to_doc`

`to_doc`实现如下：

```python
def to_doc(node):
    # node: ast.AST
    # 如果是基本类型, 直接返回
    if _is_atomic_type(node):
        return node
    # 对于tuple and list,对每个元素做to_doc
    if isinstance(node, tuple):
        return tuple(to_doc(n) for n in node)
    if isinstance(node, list):
        return [to_doc(n) for n in node]
    # 获取注册的转换函数, 例如`Module`,`FunctionDef`,`For`结点的转换函数
    func = _get_registry_entry(node.__class__.__name__, "to_doc")
    if not func:
        raise NotImplementedError(f"to_doc is not implemented for: {node.__class__.__name__}")
    return func(node)
```

> `node.__class__.__name__ `有哪些？
>
> [🔗AST](https://gist.github.com/BenkangPeng/6046ba9f79f0aa240620b3e92c9cf6ab#file-matmul_ast-py) 是一个TVM matmul的AST，可以看到AST结点类型有：`Module`,`FunctionDef`,`arguments`,`arg`,`Attribute`,`Name`,`Load`......(粉色高亮的都是类(class))
>
> 以上`python ast`中类的实现，TVM `core/doc_core.py`中有对应的实现。

`_get_registry_entry`函数获得AST上每一个类对应的转换函数，那么这些函数是怎么注册的呢？

`core/doc.py`中`Line 466`执行了`_register_default()`

```python
def _register_default():
    class DefaultTranslator:
        def __init__(self, doc_cls, func, fields):
            self.doc_cls = doc_cls  # getattr(doc, name)
            self.func = func
            self.fields = fields

        def __call__(self, node):
            kv = {attr: self.func(getattr(node, attr, None)) for attr in self.fields}
            return self.doc_cls(**kv)
	# 静态变量Registry
    Registry._inst = Registry()  # pylint: disable=protected-access
    # dir(doc): `doc_core.py`中每一个类的名称的列表
    for cls_name in dir(doc):
        doc_cls = getattr(doc, cls_name)
        # 如果`ast`中没有该类
        if not hasattr(ast, cls_name):
            continue
        if inspect.isclass(doc_cls) and issubclass(doc_cls, doc.AST):
            assert "." not in cls_name
            # 注册doc_cls对应的to_doc函数
            register_to_doc(cls_name)(
                DefaultTranslator(
                    getattr(doc, cls_name),
                    to_doc,
                    doc_cls._FIELDS,  # pylint: disable=protected-access
                )
            )
            # 注册doc_cls对应的from_doc函数
            register_from_doc(cls_name)(
                DefaultTranslator(
                    getattr(ast, cls_name),
                    from_doc,
                    doc_cls._FIELDS,  # pylint: disable=protected-access
                )
            )
```

注册的转换函数即为`DefaultTranslator.__call__`

```python
class DefaultTranslator:
        def __init__(self, doc_cls, func, fields):
            self.doc_cls = doc_cls  # getattr(doc, name)
            self.func = func
            self.fields = fields

        def __call__(self, node):
            kv = {attr: self.func(getattr(node, attr, None)) for attr in self.fields}
            return self.doc_cls(**kv)
```

关键：`kv = {attr: self.func(getattr(node, attr, None)) for attr in self.fields}`，这一行代码将`node`的所有`fields`递归转换成`doc.AST`，最后将`ast.AST`的`node`转换成`doc.AST`。

以`self.func=to_doc, node = Module`为例，

```python
kv = {attr: self.func(getattr(node, attr, None)) for attr in self.fields}
# ↓
kv = {"body":to_doc(node.body),"lineno":to_doc(node.lineno),"col_offset":to_doc(node.col_offset), "end_lineno":to_doc(node.end_lineno), "end_col_offset":to_doc(node.end_col_offset)}
# body为列表，继续递归将body中每个元素转成doc.ast
# 其他参数均为str,返回原值，即to_doc(node.lineno) = node.lineno
# ↓
return self.doc_cls(**kv)
# `Module`所有fields转换完成后，调用`doc.Module`的构造函数，将`ast.Module`转成`doc.Module`
```

经过以上转换，所有`ast`中的`class`转成了`doc`中的`class`，`ast.AST`转成了`doc.AST`



### python兼容性

从上文的实现来看，转换前后两种`AST`基本没有差异，那么为什么TVM要单独做一套`AST`呢？这是为了考虑TVM python的兼容性。

`python ast 3.6,3.7`中有`ast.Str`, `ast.Num`，但在`python ast 3.8`后，统一成了`ast.Constant`。因此`core/doc.py line 467`加了一行`_register_constant_handling()`, 如果用户的Python版本是`3.6,3.7`，那么需要给`ast.Str, ast.Num`注册一个转换到`doc.Constant`的函数。同样地，`_register_subscription_handling()`和`_register_index_handling()`均为为了兼容性而设计。之后如果python官方`ast`有新特性时，只需要"插件式"地注册新的转换函数即可，而无需大改代码。

同时，`doc.py line219`使用`ast.parse`时，优先使用`python3.8 ast`(TVM这套parser应该就是针对这个版本写的，不容易出错)。

### 调试时如何打印`doc.AST`

```python
import ast
# doc.from_doc()将doc.AST还原成ast.AST
print(ast.dump(doc.from_doc(node), indent=4))
```

