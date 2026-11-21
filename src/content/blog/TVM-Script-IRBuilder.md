---
title: 'TVM Script IR Builder'
description: 'TVM Script IR Builder' 
pubDate: 'Aug 12 2026'
tags: [TVM]
---

### Understanding `IRBuilder` Script in TVM.

> tvm version: v0.20.0

> I tried to understand the mechanism of TVM Python frontend in the past several days. 
>
> * This blog explores the `IRBuilder` scripting approach in TVM for constructing a `PrimFunc`.
>
> * [TVM doc AST](./TVM doc AST) explores the implementation of `doc.AST` in TVM.
> * [TVM PrimFunc decorator](./TVM PrimFunc decorator.md) explores the mechanism of decorator `T.prim_func`.

If we want to define a `PrimFunc`, the most straightforward method is using `IRBuilder`:

```python
with IRBuilder() as ib:
        with T.prim_func():
            T.evaluate(0)           
prim_func_actual = ib.get()
```

This is functionally equivalent to explicitly constructing a `PrimFunc` as follows:

```python
# the expected prim_func
prim_func_expected = tir.PrimFunc(
    params=[],
    body=tir.Evaluate(0),
    ret_type=None,
    buffer_map=None,
    attrs=None,
)

# Check if the generated ir is expected
assert_structural_equal(prim_func_actual, prim_func_expected, map_free_vars=True)
```

For complex `PrimFunc` definitions, the `IRBuilder` approach is more user-friendly. But how does this equivalence work under the hood?

In the following sections, we’ll walk through the complete `PrimFunc` building process in TVM to understand the underlying mechanisms.

## Complete PrimFunc Building Process in TVM

### Step 1: Create IRBuilder

```python
with IRBuilder() as ib:
```

- **C++**: Creates `IRBuilderNode` (in `base.cc`)
- **Python**: `IRBuilder.__enter__()` calls `IRBuilderEnter` (in `base.cc`)
  - Pushes `IRBuilder` to thread-local stack
  - Clears `frames` array
  - Sets `result = NullOpt`

### Step 2: Create PrimFuncFrame

```python
with T.prim_func():
```

- **C++**: `PrimFunc()` creates `PrimFuncFrameNode` (in `tir/ir.cc`)

  - Returns a `PrimFuncFrame` object

- **Python**: `__enter__()` calls `IRBuilderFrameEnter` (in `base.py:64`)

  - **C++**: `IRBuilderFrameNode::EnterWithScope()` (in `base.cc:27-29`)

    ```cpp
    void IRBuilderFrameNode::EnterWithScope() {
        /// Store the PrimFuncFrame into IRBuilderNode.frames
      IRBuilder::Current()->frames.push_back(GetRef<IRBuilderFrame>(this));
    }
    ```

  - **This pushes `PrimFuncFrame` into `IRBuilder.frames`!**

### Step 3: Add Statements

```python
T.evaluate(0)
```

- **C++**: `Evaluate()` function (in `tir/ir.cc:609`)
  - Calls `AddToParent(tvm::tir::Evaluate(value))`
  - `AddToParent` (in `tir/utils.h`) finds the current `PrimFuncFrame` and adds the statement to its `stmts` array
  - **The statement `tvm::tir::Evaluate` is stored in `PrimFuncFrame->stmts`**

### Step 4: Exit PrimFuncFrame    **THE KEY STEP**

```python
# when exiting the 'with T.prim_func():' scope
```

- **Python**: `__exit__()` calls `IRBuilderFrameExit` (in `base.py:70`)

  - **C++**: `IRBuilderFrameNode::ExitWithScope()` (in `base.cc:31-37`)

    ```cpp
    void IRBuilderFrameNode::ExitWithScope() {
      for (auto it = callbacks.rbegin(); it != callbacks.rend(); ++it) {
        (*it)();
      }
      this->callbacks.clear();
      IRBuilder::Current()->frames.pop_back();  // ← Pops the PrimFuncFrame
    }
    ```

  - **BUT** before the base `ExitWithScope()` is called, the **virtual function** `PrimFuncFrameNode::ExitWithScope()` runs! (in `tir/frame.cc:31-65`)

    ```cpp
    void PrimFuncFrameNode::ExitWithScope() {
      TIRFrameNode::ExitWithScope();  // ← Calls parent (base) ExitWithScope first
      
      // Create the PrimFunc from accumulated data:
      tvm::tir::PrimFunc func(
          /*params=*/args,
          /*body=*/AsStmt(stmts),  // ← All collected statements!
          /*ret_type=*/ret_type.value_or(TupleType::Empty()),
          /*buffer_map=*/buffer_map,
          /*attrs=*/DictAttrs(attrs));
      
      func = tvm::tir::ScriptComplete(func, root_alloc_buffers);
      
      IRBuilder builder = IRBuilder::Current();
      if (builder->frames.empty()) {
        // ⭐ NO OTHER FRAME: Store result in builder->result
        ICHECK(!builder->result.defined());
        builder->result = func;  // ← Store the PrimFunc into IRBuilderNode.result
      } else if (Optional<ir::IRModuleFrame> opt_frame = ...) {
        // Has IRModuleFrame: Add to module
        ir::DeclFunction(func_name, func);
        ir::DefFunction(func_name, func);
      }
    }
    ```

### Step 5: Retrieve the Result

```python
prim_func_actual = ib.get()
```

- **Python**: `IRBuilder.get()` calls `IRBuilderGet` (in `base.py:154`)

  - **C++**: `IRBuilderNode::Get<ObjectRef>()` (in `base.h:292-298`)

    ```cpp
    template <typename TObjectRef>
    inline TObjectRef IRBuilderNode::Get() const {
      CHECK(result.defined()) << "IndexError: No result exists in IRBuilder yet";
      const auto* n = result.as<TObject>();
      CHECK(n != nullptr) << "TypeError: IRBuilder result is not of type...";
      return GetRef<TObjectRef>(n);  // ← Returns the stored PrimFunc!
    }
    ```

## Summary: The Crucial Understanding

1. **PrimFuncFrame is NOT thrown away** - Before being popped, it **constructs the final `PrimFunc`** object from all the data it collected
2. The constructed `PrimFunc` is **stored in `IRBuilder.result`** (line 49 in frame.cc)
3. The frame itself is then popped and can be destroyed - **its job is done**
4. `ib.get()` retrieves the `PrimFunc` from `IRBuilder.result`

<img src="images/Inhere IRBuilder.jpg" alt="Inhere IRBuilder" style="zoom: 33%;" />



See also:

* [TVM doc AST](./TVM doc AST)
* [TVM PrimFunc decorator](./TVM PrimFunc decorator.md)
