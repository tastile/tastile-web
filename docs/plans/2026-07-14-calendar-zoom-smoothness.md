# Calendar zoom smoothness — 2026-07-14

## Symptom

`tastile-web` の `/dashboard/timeline/[view]` (Day / Week view) で Ctrl+wheel ズーム・
トラックパッドピンチ・2 本指タッチピンチの挙動が**カクカク**する。ジェスチャー中は
フレーム落ちが目立ち、カーソル追従も遅れる。

## Root cause

`src/lib/hooks/use-zoom.ts` は `setZoom(newZoom)` を **wheel / touchmove 1 イベント毎に**
呼んでおり、ジェスチャー継続中は 60+ Hz で `DayView` / `WeekView` を再描画する。各
レンダーで:

- `layoutDayLanes` (useMemo) が `hourHeight` 変化で無効化され再計算
- 24 個分の hour cell + N 個分の event block が毎回新規 JSX / style object で再生成
- コンテナーの高さ (`24 * hourHeight`)、`backgroundSize`、event top/height が全て
  リフローを起こす

これだけで 1 フレーム 16ms を超え、特にトラックパッドピンチ (Ctrl+wheel を連続発火)
で破綻する。

## Fix

### 1. `useZoom` のリファクタ (主因)

ジェスチャー中は **CSS `transform: scaleY(ratio)` + `transform-origin: 0 anchorRel px`** で
視覚ズームを直接 DOM 更新する。`setZoom` はジェスチャー終了時に 1 回だけコミット:

- **Touch pinch**: `touchmove` 中は transform のみ更新。`touchend` でコミット →
  ジェスチャー中 **React 再描画ゼロ**
- **Wheel / trackpad pinch**: `wheel` 中は transform のみ更新。`requestAnimationFrame`
  でコミット coalescing → **最大 1 レンダー/フレーム**

`transform-origin` を cursor / pinch midpoint の相対 Y 座標に置くことで、カーソル直下の
時刻が視覚的に静止する (CSS の scale は transform-origin 上の点を動かさない)。

コミット時は:

1. transform をクリア
2. `getBoundingClientRect` + `findScrollParent` でスクロール位置を計算
3. `setZoom(finalZoom)` + `scrollParent.scrollTop = old + anchorRel * (ratio - 1)`

これでジェスチャー中の jank を消し、コミット時のレイアウトも cursor 下時刻を保持する。

### 2. `DayView` / `WeekView` の防御的メモ化 (副因)

コミットが走るのは最大 60 回/秒 (wheel rAF) または 1 回/ジェスチャー (touch) だが、
それでも hour cell の style オブジェクト生成は毎回走る。最低限:

- hour cell をモジュール外で抽出し `React.memo`
- event block を抽出し `React.memo` + props 安定化
- `onClick` ハンドラを `useCallback`

これにより wheel rAF レンダーは **「hourHeight が変わった cell の style 更新のみ」** に
絞り込める。

## Verification

- `bun test src/lib/hooks/use-zoom.test.tsx` 全件 pass (touch 系は `touchend` を追加)
- `bun test src/components/calendar` 全件 pass
- `bun dev` → `/dashboard/timeline/day` で Ctrl+wheel を回したときに視覚が
  即時に追従・滑らか、wheel 停止後に layout が安定
- Chrome DevTools Performance パネルで Ctrl+wheel 中のフレームレートが 60fps を維持

## Non-goals

- Zoom UI (ボタンなど) の追加はしない
- Hour cell の見た目の変更はしない
- WeekView / MonthView のリファクタはしない (zoom は DayView / WeekView のみ使う)
