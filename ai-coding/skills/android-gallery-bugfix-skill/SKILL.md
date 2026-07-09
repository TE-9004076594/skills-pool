---
name: android-gallery-bugfix-skill
description: Diagnose and fix Android gallery, photo-picker, MediaStore, and image-loading issues — including permissions (Android 9–14+), Scoped Storage, URI access, EXIF orientation, Glide/Coil/Picasso errors, OOM, and list/preview/save/delete failures.
license: MIT
compatibility: Android (Gradle) projects. Used for reference during openspec-android-bug investigation when the triage category is Gallery / Media.
metadata:
  author: openspec
  version: "1.0"
---

# Android Gallery Bugfix Skill

## 适用范围

用于 Android 项目中 Gallery / 相册 / 图片选择 / 图片浏览 / 图片保存相关问题的排查、修复和验证，包括但不限于：

- 相册打不开
- 图片列表为空
- 图片加载慢
- 缩略图显示异常
- 图片方向错误
- 图片保存失败
- 图片删除失败
- 图片扫描不到
- 图片选择失败
- Android 10+ 分区存储问题
- MediaStore 查询异常
- Glide / Coil / Picasso 加载异常
- OOM / Bitmap 内存问题
- 大图预览卡顿
- EXIF 信息异常
- 视频和图片混合列表异常
- 权限问题

---

## Bugfix 总体原则

相册类问题通常和以下因素相关：

1. 存储权限
2. Android 版本差异
3. Scoped Storage / 分区存储
4. MediaStore 查询
5. URI 权限
6. 图片解码
7. 缩略图缓存
8. EXIF 方向
9. 文件路径和 content uri 混用
10. 大图内存优化
11. 异步加载和 RecyclerView 复用

处理时必须区分：

- 文件不存在
- 没有权限
- MediaStore 未扫描
- URI 不可访问
- 解码失败
- 缩略图加载失败
- UI 绑定错误

---

## 常见问题分类

### 1. 相册列表为空

重点检查：

- 是否有 READ 权限
- Android 13+ 是否申请 READ_MEDIA_IMAGES / READ_MEDIA_VIDEO
- Android 10+ 是否适配 Scoped Storage
- MediaStore 查询条件是否过窄
- selection / sortOrder 是否错误
- 查询的是 Images 还是 Files
- 是否只查外部存储
- 是否被 MIME type 过滤掉
- 文件是否已被 MediaScanner 扫描

权限差异：

```text
Android 12 及以下:
- READ_EXTERNAL_STORAGE

Android 13+:
- READ_MEDIA_IMAGES
- READ_MEDIA_VIDEO
- READ_MEDIA_AUDIO

Android 14+:
- READ_MEDIA_VISUAL_USER_SELECTED
```

---

### 2. 图片加载失败

重点检查：

- URI 是否有效
- 文件是否存在
- 是否有 URI 权限
- 是否在后台线程解码
- 图片是否损坏
- 是否为 HEIC / WEBP / RAW 等特殊格式
- Glide / Coil / Picasso 是否配置正确
- RecyclerView 复用导致错图

常见日志关键字：

```text
FileNotFoundException
SecurityException
BitmapFactory
ImageDecoder
GlideException
Coil
Picasso
openInputStream
decodeStream
```

---

### 3. 图片方向错误

重点检查：

- 是否读取 EXIF orientation
- 是否对 content uri 支持 EXIF 读取
- 是否只处理 file path，未处理 input stream
- 前置摄像头图片是否镜像
- 压缩后是否丢失 EXIF

常用类：

```kotlin
ExifInterface
Matrix
BitmapFactory
ImageDecoder
```

修复建议：

- 从 InputStream 读取 EXIF
- 保存压缩图时保留必要 EXIF
- 显示层优先让图片加载库处理 orientation
- 避免重复旋转

---

### 4. 图片保存失败

重点检查：

- Android 版本
- 是否直接写公共目录
- 是否使用 MediaStore
- 是否设置 RELATIVE_PATH
- 是否设置 IS_PENDING
- OutputStream 是否 close
- 文件名是否非法
- 存储空间是否不足
- 是否需要触发媒体扫描

Android 10+ 推荐：

```kotlin
MediaStore.Images.Media.EXTERNAL_CONTENT_URI
ContentValues
RELATIVE_PATH
DISPLAY_NAME
MIME_TYPE
IS_PENDING
contentResolver.openOutputStream(uri)
```

保存后：

```kotlin
IS_PENDING = 0
```

---

### 5. 删除失败

重点检查：

- Android 10+ 是否需要用户授权删除
- 是否使用 ContentResolver.delete
- 是否捕获 RecoverableSecurityException
- 是否处理系统确认弹窗
- 是否有写入权限
- 是否删除后刷新列表

Android 11+ 常见方式：

```kotlin
MediaStore.createDeleteRequest(...)
```

---

### 6. OOM / 加载卡顿

重点检查：

- 是否直接加载原图
- 是否根据 View 尺寸采样
- 是否在主线程解码
- RecyclerView 是否复用
- 是否开启过大的缓存
- 是否一次性查询或加载全部图片
- 是否大图预览没有 tile / subsampling

修复建议：

- 使用 Glide / Coil 缩放加载
- RecyclerView 分页
- 使用 Paging
- 大图使用 subsampling
- 避免 Bitmap 常驻内存
- onViewRecycled 中取消加载
- 使用缩略图优先

---

## 推荐排查流程

### Step 1：确认复现条件

记录：

- 设备型号
- Android 版本
- 是否 Android 10+
- 是否 Android 13+
- 是否首次安装
- 权限是否授权
- 是图片、视频还是混合媒体
- 来源：相机拍摄 / 下载 / 微信 / 浏览器 / 系统截图
- 文件格式：JPG / PNG / HEIC / WEBP / GIF / RAW
- 是列表页、选择页、预览页还是保存页
- 复现概率

---

### Step 2：收集日志

推荐命令：

```bash
adb logcat -v time > gallery_bug.log
adb shell dumpsys package your.package.name > package_info.txt
adb shell dumpsys media.provider > media_provider.txt
```

检查文件：

```bash
adb shell ls -l /sdcard/DCIM/
adb shell ls -l /sdcard/Pictures/
adb shell ls -l /sdcard/Download/
```

检查权限：

```bash
adb shell appops get your.package.name
adb shell dumpsys package your.package.name | grep permission
```

---

### Step 3：定位层级

按照以下顺序判断：

1. App 是否有读取权限
2. MediaStore 是否能查询到数据
3. 查询条件是否正确
4. URI 是否可访问
5. 图片是否可解码
6. 缩略图是否正确加载
7. RecyclerView 绑定是否正确
8. 图片预览是否处理方向和大图
9. 保存 / 删除是否符合 Android 版本要求

---

## MediaStore 查询检查项

重点检查：

```kotlin
MediaStore.Images.Media.EXTERNAL_CONTENT_URI
MediaStore.Video.Media.EXTERNAL_CONTENT_URI
MediaStore.Files.getContentUri("external")
ContentResolver.query(...)
```

必须确认：

- projection 不为空或字段存在
- selection 正确
- sortOrder 正确
- cursor 正确 close
- `_ID` 正确拼接 content uri
- DATA 字段在 Android 10+ 不应强依赖
- 不要直接依赖绝对路径

推荐使用：

```kotlin
ContentUris.withAppendedId(
    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
    id
)
```

---

## Android 版本适配重点

### Android 9 及以下

常见权限：

```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

---

### Android 10

重点：

- Scoped Storage
- MediaStore 写入
- 不建议直接使用 file path 访问公共目录
- 可临时使用 requestLegacyExternalStorage，但不推荐长期依赖

---

### Android 11 / 12

重点：

- 更严格的公共目录访问
- 删除 / 修改他人媒体需要用户授权
- MANAGE_EXTERNAL_STORAGE 不应滥用

---

### Android 13+

重点权限：

```xml
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
```

---

### Android 14+

重点：

```xml
<uses-permission android:name="android.permission.READ_MEDIA_VISUAL_USER_SELECTED" />
```

需要处理用户只授权部分照片的情况。

---

## 图片加载库检查

### Glide

重点检查：

```kotlin
Glide.with(context)
    .load(uri)
    .thumbnail(...)
    .override(width, height)
    .into(imageView)
```

注意：

- Fragment / View 生命周期
- RecyclerView 复用
- 清理请求
- 加载 content uri
- placeholder / error 图

---

### Coil

重点检查：

```kotlin
imageView.load(uri) {
    crossfade(true)
    size(width, height)
}
```

注意：

- lifecycle
- memory cache
- disk cache
- SVG / GIF / HEIC 支持

---

## 常见修复策略

- 修复 Android 13+ 媒体权限
- Android 14 处理部分照片授权
- 不再依赖 MediaStore DATA 字段
- 使用 content uri 替代 file path
- 查询 Cursor 后及时 close
- 图片保存改用 MediaStore
- 删除媒体时使用系统授权流程
- 图片解码增加采样
- RecyclerView 中取消旧请求
- 修复 EXIF 方向处理
- 增加空列表、权限拒绝、加载失败 UI
- 大图预览使用压缩或分块加载
- 异步加载避免阻塞主线程

---

## 代码审查重点

修复 gallery bug 时，必须检查：

- 是否兼容 Android 10+
- 是否兼容 Android 13+
- 是否兼容 Android 14 部分照片权限
- 是否处理权限拒绝
- 是否处理 URI 失效
- 是否关闭 Cursor / InputStream / OutputStream
- 是否避免主线程解码
- 是否避免 OOM
- 是否处理 RecyclerView 错图
- 是否处理图片方向
- 是否处理保存失败
- 是否处理删除授权
- 是否处理空数据状态

---

## 验证清单

至少验证：

- 首次安装进入相册
- 权限拒绝
- 权限允许
- Android 13 图片权限
- Android 13 视频权限
- Android 14 部分照片授权
- 图片列表加载
- 视频列表加载
- 混合媒体列表
- 大图预览
- HEIC 图片
- GIF 图片
- 图片方向
- 拍照后刷新相册
- 保存图片
- 删除图片
- 存储空间不足
- 快速滑动列表
- 前后台切换
- 横竖屏切换

---

## 输出 Bugfix 结论模板

```text
Root Cause:
- 问题原因：

Fix:
- 修改内容：

Risk:
- 影响范围：

Verification:
- 已验证场景：
- 未覆盖场景：

Logs:
- 关键日志：
```

## Heuristics
- For "empty gallery" on Android 13+, always check the per-media-type granular permissions (`READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`) before blaming MediaStore.
- For "photo not visible after save" — suspect `IS_PENDING = 1` still set, or MediaStore entry created but OutputStream not flushed/closed, or the app bypassed the media scanner.
- For "wrong orientation" — check EXIF read path: `ExifInterface` works on InputStream/Uri path but some libraries silently drop EXIF when compressing/resizing.
- For "blurry / wrong image in RecyclerView" — classic missing `.into()` after cancel, or Glide/Coil request not cancelled in `onViewRecycled`.
- For "image load fails on Android 13+ but works on older" — suspect `READ_EXTERNAL_STORAGE` still used instead of `READ_MEDIA_IMAGES`, or `content://` Uri permissions not persisted across process restart.
- For "image visible in file manager but not in query results" — check MediaScanner has run, and that projection/sortOrder/selection aren't excluding it by MIME type or `IS_PENDING` flag.
- For "OOM in gallery list" — always suspect: no sampling on decode, loading full-res for a thumbnail slot, no Paging, no per-item Glide/Coil override to view size.
- For "Android 14 partial selection shows nothing" — the app did not handle `READ_MEDIA_VISUAL_USER_SELECTED` and didn't check Uri availability per item.

## Anti-Patterns
- Catching `SecurityException` around a storage call without first checking permission state — hides the real bug.
- Using `MediaStore.Images.ImageColumns.DATA` (absolute path) on Android 10+ — the column is deprecated/unreliable under Scoped Storage.
- Opening `FileInputStream(uri.path)` on a `content://` Uri — must use `contentResolver.openInputStream(uri)`.
- Loading full-resolution bitmaps into RecyclerView thumbnails instead of sampling to view dimensions.
- Holding Bitmap references in static/cache without bounds or eviction.
- Calling `ContentResolver.delete` then refreshing the list without handling `RecoverableSecurityException` on Android 10+ / `MediaStore.createDeleteRequest` on Android 11+.
- Setting `IS_PENDING = 1` on MediaStore insert and forgetting to flip it to `0` after write — leaves entries invisible to other apps/scanners.
- Depending on `requestLegacyExternalStorage` as a fix rather than a migration window on Android 10.
- Logging user photo `Uri`s verbatim — leaks private picture paths; redact to `id` + MIME type.
- Treating gallery issues as "UI-only" and skipping permission + MediaStore + storage-layer checks.

## CodeGraph Integration

CodeGraph helps ground the gallery diagnosis in the actual codebase structure. Run it before proposing a fix.

**When to run CodeGraph**:
- After the triage narrows the symptom to a specific gallery sub-area (list load / save / delete / orientation / OOM / picker)
- When tracing the data flow from MediaStore query → URI handling → image loading → UI binding
- When the fix may change how multiple screens consume a shared image repository

**How**:
```bash
codegraph explore "<GalleryRepository or MediaStore query entry>"
codegraph explore "<image-loading call site, e.g., Glide entry>"
codegraph explore "<save / delete code path>"
```

**What to look for from CodeGraph results (gallery-focused)**:
- **Callers of the MediaStore query method** — do all callers pass the same projection/selection, or are some paths using deprecated columns or wrong MIME filters?
- **Uri consumer chain** — who receives the Uri from the query result, and does anyone convert it back to a file path (a Scoped Storage anti-pattern)?
- **Image-loading entry points** — which `Glide`/`Coil`/`Picasso` call sites load the suspect Uri, and which lifecycle scopes them (Fragment vs Application)?
- **Write/save call sites** — which callers set `IS_PENDING`, open the OutputStream, and flip `IS_PENDING` back to `0`. A missing flip is a common root cause.
- **Delete paths** — which callers use `ContentResolver.delete` vs `MediaStore.createDeleteRequest`, and whether `RecoverableSecurityException` is handled.
- **RecyclerView adapter binding** — the on-bind handler that calls into the image loader; paired with `onViewRecycled` for cancellation.
- **Downstream impact** — screens that share the same repository; a fix that changes Uri access semantics may break the preview or share flow.

**Scope note**: CodeGraph does not reliably index XML layouts, `res/values`, `AndroidManifest.xml`, or Gradle build scripts. For gallery issues rooted in manifest permissions, `requestLegacyExternalStorage`, or `network_security_config`, supplement with `rg`/`find`. Also scan `settings.gradle` for multi-module dependencies on the image loading library.

**Fallback**: If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker. Fall back to `rg`/grep for MediaStore / image-loader / save-path call-site search.

## Guardrails
- Run the full triage classification before jumping to a code fix — gallery bugs are disproportionately driven by Android version + permission state.
- Always check Android 10 / 13 / 14 permission differences for media access before editing code.
- Always verify the fix with real devices on at least two API levels (e.g., API 29 and API 34+) — gallery behavior is highly version-sensitive.
- Always confirm the MediaStore query projection is version-appropriate — `DATA` is deprecated under Scoped Storage.
- Always confirm `IS_PENDING` toggling on MediaStore insert/update is correct.
- Always close `Cursor`, `InputStream`, `OutputStream` — resource leaks show up as OOM / stale scans hours later.
- Always use `contentResolver.openInputStream(uri)` on `content://` Uris, never `FileInputStream(uri.path)`.
- Never log photo Uris or absolute paths verbatim — redact to `id` + MIME type to avoid PII leakage.
- Do not mask storage errors with a broad try/catch — find and fix the missing permission / missing scan / deprecated column first.
- If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker. Fall back to `rg`/grep.