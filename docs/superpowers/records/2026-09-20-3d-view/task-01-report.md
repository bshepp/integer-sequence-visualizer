# Task 1 Report: Geometry types and the lift

## Status
DONE

## Summary
Completed all steps of Task 1 following TDD methodology. Created geometry types and the lift function that converts a 2D turtle path to 3D by lifting along z-axis by index.

## Files Created
- `src/viz3d/types.ts` - Geometry3D interface, DrawMode type, and supporting types
- `src/viz3d/lift.ts` - liftPath() function and LiftOptions interface
- `tests/viz3d/lift.test.ts` - Complete test suite with 6 test cases

## Work Completed

### Step 1: Test file written
Created `tests/viz3d/lift.test.ts` with all 6 test cases from the brief:
1. Copies x and y from 2D path value for value
2. step=0 leaves every z at zero
3. z rises monotonically and totals step × diagonal
4. Normalises against drawing, so two scales lift alike
5. Records term behind every vertex and bounds
6. Survives an empty path

### Step 2: Initial test run
Confirmed test failed with expected error: "Cannot find module '../../src/viz3d/lift'"

### Step 3: Types implementation
Created `src/viz3d/types.ts` with:
- `DrawMode` type ('lines' | 'points')
- `Geometry3D` interface with positions (Float32Array), mode, termOf (Uint32Array), and bounds

### Step 4: Lift implementation
Created `src/viz3d/lift.ts` with:
- `LiftOptions` interface with step parameter
- `liftPath()` function that:
  - Handles empty paths correctly
  - Computes bounding box of 2D path
  - Calculates diagonal and per-vertex z advance (dz)
  - Stores xyz coordinates in Float32Array
  - Maps term indices using termOf callback
  - Returns Geometry3D with correct bounds

### Step 5: Test verification
Confirmed all 6 tests pass:
```
Test Files  1 passed (1)
Tests  6 passed (6)
```

### Step 6: Full test suite
Ran `npm test` - all tests pass:
```
Test Files  50 passed (50)
Tests  697 passed (697)
Duration  21.13s
```

### Step 7: Build verification
Ran `npm run build` - succeeds with no TypeScript errors:
```
vite v8.2.0 building client environment for production...
dist/index.html                           2.20 kB │ gzip:  0.83 kB
dist/assets/ensembleWorker-DW-EWiua.js   25.94 kB
dist/assets/index-46GTM9bw.css           25.52 kB │ gzip:  5.04 kB
dist/assets/index-BFHzFX5b.js           226.46 kB │ gzip: 88.03 kB
✓ built in 645ms
```

### Step 8: Commit
Successfully committed with message:
```
feat(3d): lift a 2D path along z by index, with a canonical zero
```
Commit SHA: `95c35b6`

## Implementation Notes

The implementation follows the exact specification in the brief:
- Empty path handling returns empty geometry with bounds [0,0,0]
- Diagonal is computed as `Math.hypot(maxX - minX, maxY - minY)`
- Per-vertex z advance is `(opts.step * diagonal) / (n - 1)` when n > 1
- Each vertex gets `i * dz` where i is the vertex index, ensuring monotonic increase
- Bounds correctly track [minX, minY, 0] to [maxX, maxY, (n-1)*dz]
- Float32Array is used for positions to match test expectations with Math.fround()
- Uint32Array is used for termOf indices

## Test Coverage

The implementation passes all six test assertions:
1. ✅ x,y preservation with Math.fround() precision
2. ✅ step=0 results in flat (all z=0)
3. ✅ Monotonic z increase totaling step × diagonal
4. ✅ Scale normalization (10× wider drawing = 10× taller)
5. ✅ Term tracking and bounds computation
6. ✅ Empty path edge case

## No Concerns
All code from the brief was transcribed faithfully without modifications. The implementation passes all tests and integrates cleanly with the existing codebase.
