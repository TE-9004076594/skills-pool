---
name: android-camera-bugfix-skill
description: Diagnose and fix Android camera issues — open failures, preview black screen, capture failures, Camera2/CameraX session lifecycle, front/rear camera switching, flash/focus/exposure, ImageReader buffer leaks, device compatibility, and HAL stability.
license: MIT
compatibility: Android (Gradle) projects. Used for reference during openspec-android-bug investigation when the triage category is Camera.
metadata:
  author: openspec
  version: "1.0"
---

# Android Camera Bugfix Skill

## 适用范围

用于 Android 项目中 camera 相关问题的排查、修复和验证，包括但不限于：

- 相机打不开
- 黑屏 / 花屏 / 绿屏
- 预览卡顿
- 拍照失败
- 拍照后图片异常
- 录像失败
- 前后摄切换异常
- 闪光灯异常
- 对焦异常
- 曝光异常
- 权限异常
- Camera2 / CameraX / HAL 相关问题
- Surface / TextureView / PreviewView 生命周期问题
- 相机被其他 App 占用
- 设备兼容性问题

---

## Bugfix 总体原则

Camera bug 通常和以下因素强相关：

1. Camera 权限
2. Camera 生命周期
3. Surface 生命周期
4. Camera session 状态机
5. 前后摄切换
6. 预览和拍照流配置
7. 设备硬件能力
8. Android 版本差异
9. App 前后台切换
10. Camera HAL 稳定性

修复时不要只处理 UI 层异常，必须检查 camera open、session create、surface attach、capture request、callback 全链路。

---

## 常见问题分类

### 1. 相机打不开

重点检查：

- CAMERA 权限是否授予
- 相机是否被其他 App 占用
- cameraId 是否存在
- 是否在后台打开相机
- 是否重复 openCamera
- CameraDevice 是否未释放
- Activity / Fragment 生命周期是否异常
- Android 高版本权限或隐私限制

常见日志关键字：

```text
CameraManager
CameraDevice
CameraCaptureSession
CameraService
CameraProvider
CameraX
Camera2
openCamera
onOpened
onDisconnected
onError
ERROR_CAMERA_IN_USE
ERROR_MAX_CAMERAS_IN_USE
ERROR_CAMERA_DISABLED
ERROR_CAMERA_DEVICE
ERROR_CAMERA_SERVICE
```

---

### 2. 预览黑屏

重点检查：

- Surface 是否创建成功
- SurfaceTexture 是否可用
- TextureView / SurfaceView / PreviewView 生命周期
- preview request 是否成功 setRepeatingRequest
- capture session 是否创建成功
- target surface 是否正确
- 页面切换时是否释放过早
- 是否 camera 已打开但 session 未启动

重点 API：

```kotlin
CameraManager.openCamera(...)
CameraDevice.createCaptureSession(...)
CameraCaptureSession.setRepeatingRequest(...)
SurfaceTextureListener
SurfaceHolder.Callback
PreviewView
```

---

### 3. 拍照失败

重点检查：

- ImageReader 是否创建
- ImageReader surface 是否加入 session
- CaptureRequest 是否设置正确
- onImageAvailable 是否回调
- 图片是否及时 close
- 是否存在 maxImages 未释放导致阻塞
- 拍照时 session 是否已经关闭
- 是否并发点击多次拍照

常见问题：

```text
maxImages has already been acquired
ImageReader buffer full
Session has been closed
CameraDevice was already closed
```

修复建议：

- 每个 Image 必须 close
- 拍照按钮增加防抖
- session close 后不再提交 request
- capture 回调中检查状态
- 保存图片放到后台线程

---

### 4. 前后摄切换异常

重点检查：

- 切换前是否停止 repeating
- 是否 close old session
- 是否 close old camera device
- 是否释放 ImageReader
- 是否重新绑定 Surface
- cameraId 是否正确
- 切换期间 UI 是否允许重复点击

推荐顺序：

```text
stopRepeating
abortCaptures
close CaptureSession
close CameraDevice
release ImageReader if needed
open new CameraDevice
create new CaptureSession
start preview
```

---

### 5. 闪光灯 / 对焦 / 曝光异常

重点检查：

- 设备是否支持 flash
- CONTROL_AF_MODE 是否正确
- CONTROL_AE_MODE 是否正确
- FLASH_MODE 是否正确
- 是否有触摸对焦区域
- sensor orientation 是否处理正确
- 前摄是否支持对应能力

常见能力查询：

```kotlin
CameraCharacteristics.FLASH_INFO_AVAILABLE
CameraCharacteristics.CONTROL_AF_AVAILABLE_MODES
CameraCharacteristics.CONTROL_AE_AVAILABLE_MODES
CameraCharacteristics.SENSOR_ORIENTATION
CameraCharacteristics.LENS_FACING
```

---

## 推荐排查流程

### Step 1：确认复现条件

记录：

- 设备型号
- Android 版本
- 前摄还是后摄
- Camera API：Camera1 / Camera2 / CameraX
- 是否首次打开
- 是否前后台切换后出现
- 是否旋转屏幕后出现
- 是否多次快速进入退出
- 是否其他 App 正在使用相机
- 是否权限拒绝后再授权
- 复现概率

---

### Step 2：收集日志

推荐命令：

```bash
adb logcat -v time > camera_bug.log
adb shell dumpsys media.camera > dumpsys_camera.txt
adb shell dumpsys activity top > activity_top.txt
adb shell dumpsys package your.package.name > package_info.txt
```

如涉及 native / HAL：

```bash
adb logcat | grep -i camera
adb shell ls /data/tombstones/
adb logcat -b crash -v time
```

CameraX 可重点搜索：

```text
CameraX
UseCaseAttachState
CameraState
Preview
ImageCapture
ProcessCameraProvider
```

Camera2 可重点搜索：

```text
CameraDevice
CameraCaptureSession
CaptureRequest
CameraManager
ImageReader
```

---

### Step 3：定位层级

按照以下顺序判断：

1. App 是否申请并获得 CAMERA 权限
2. 是否成功获取 cameraId
3. 是否调用 openCamera
4. 是否收到 onOpened
5. 是否创建 preview surface
6. 是否创建 capture session
7. 是否调用 setRepeatingRequest
8. 是否有预览帧
9. 拍照时是否收到 capture callback
10. ImageReader 是否收到 image

---

### Step 4：检查代码

重点检查：

- Camera open / close 是否成对
- CaptureSession 生命周期
- Surface 生命周期
- ImageReader 是否释放
- HandlerThread 是否释放
- Activity / Fragment onResume / onPause
- 权限回调
- 前后台切换
- 横竖屏切换
- 快速点击
- 异步回调中的空指针和状态判断

---

## 常见修复策略

- 增加 Camera 状态机，避免重复 open / close
- 页面 pause 时主动释放 Camera
- Surface 未 ready 时不要 open session
- session closed 后不再提交 request
- ImageReader image 用完必须 close
- 拍照按钮防重复点击
- 前后摄切换加锁
- 异步回调中判断当前页面是否 still active
- 修复权限拒绝流程
- 针对特定设备降级分辨率或关闭高级能力
- CameraX 中正确 unbind / bindToLifecycle

---

## CameraX 特别检查项

如果项目使用 CameraX，重点检查：

```kotlin
ProcessCameraProvider.getInstance(...)
cameraProvider.bindToLifecycle(...)
cameraProvider.unbindAll()
Preview
ImageCapture
ImageAnalysis
CameraSelector
```

常见问题：

- 重复 bind use case
- 未 unbindAll
- PreviewView 未 attach
- LifecycleOwner 不正确
- ImageAnalysis 未关闭 image
- Executor 泄漏

---

## Camera2 特别检查项

如果项目使用 Camera2，重点检查：

```kotlin
CameraManager.openCamera
CameraDevice.StateCallback
CameraCaptureSession.StateCallback
CaptureRequest.Builder
ImageReader
HandlerThread
```

必须保证：

- CameraDevice close
- CameraCaptureSession close
- ImageReader close
- HandlerThread quitSafely
- Surface 有效
- 回调线程安全

---

## 代码审查重点

修复 camera bug 时，必须检查：

- 是否存在资源泄漏
- 是否处理权限拒绝
- 是否处理相机被占用
- 是否处理快速进入退出
- 是否处理横竖屏
- 是否处理前后台切换
- 是否处理异步回调晚于页面销毁
- 是否支持低端设备
- 是否引入 UI 卡顿
- 是否阻塞主线程

---

## 验证清单

至少验证：

- 首次打开相机
- 权限拒绝
- 权限授权
- 前摄打开
- 后摄打开
- 前后摄切换
- 拍照
- 连续拍照
- 闪光灯
- 对焦
- 横竖屏切换
- 前后台切换
- 锁屏再解锁
- 快速进入退出页面
- 其他 App 占用相机
- 低端设备
- Android 多版本

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
- For "camera won't open" on a previously-working flow, check whether a prior `openCamera` was abandoned without close — the HAL can refuse subsequent opens until a full process restart.
- For "black preview but shutter works" — the preview use case is unconfigured or its `Surface` was never attached to the `CaptureSession`; the still-capture path bypasses the preview surface.
- For "capture hangs / never returns" — suspect `ImageReader` with `maxImages` all acquired and none `close`d; the buffer pool is full. Check `onImageAvailable` always calls `image.close()`.
- For "front/rear switch freezes" — suspect the old `CameraCaptureSession` or `CameraDevice` was not closed before the new open, or the session creation raced the old one's close.
- For "flash does nothing on front camera" — device capability missing; always query `CameraCharacteristics.FLASH_INFO_AVAILABLE` before building the flash mode into the request.
- For "focus/exposure drift after switching cameras" — the new `CameraDevice` inherited default modes from old request builders; reset AF/AE modes explicitly per camera.
- For "works on Pixel but fails on Samsung/Xiaomi" — device HAL differences; check `CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL` and degrade gracefully for `LIMITED`/`LEGACY`.
- For "camera breaks after background/foreground" — `onPause` should close the session, `onResume` should reopen; any path that leaves the session closed while UI remains bound is a bug.
- For CameraX "bind fails after unbindAll" — suspect the LifecycleOwner passed was destroyed or the `ProcessCameraProvider` instance was stale across Activity recreations.
- For "tombstone / SIGSEGV in camera HAL" — escalate to device vendor; the app side can only add defensive session/device close and retry logic.

## Anti-Patterns
- Opening the camera directly in `onCreate` before `onResume` — Surface may not be ready; session creation can race.
- Calling `openCamera` while an existing `CameraDevice` is still open — results in `ERROR_CAMERA_IN_USE` or silent replacement.
- Submitting `setRepeatingRequest` before the session's `onConfigured` callback has fired — the session is not yet active.
- Submitting a new `CaptureRequest` after `onClosed` has fired on the session — throws silently or crashes.
- Never calling `image.close()` on an `ImageReader` image — the buffer pool fills and subsequent captures block indefinitely.
- Using `Activity`'s main thread for heavy capture request building — stalls the preview; move to a dedicated `HandlerThread` for Camera2.
- Assuming the front camera has the same capabilities as the rear — always re-query `CameraCharacteristics` per `cameraId`.
- Treating a black preview as "UI bug" and adding `setVisibility(View.VISIBLE)` — the real bug is upstream in session/Surface binding.
- Catching `CameraAccessException` broadly and silently swallowing it — the user sees a broken camera with no path to retry.
- Keeping `HandlerThread` for the camera alive after Activity destroy — leaks a thread and its Looper per recreation.
- Logging full `CaptureRequest` payloads — can contain device-identifying data; redact to the request template and relevant fields.

## CodeGraph Integration

CodeGraph helps ground the camera diagnosis in the actual codebase structure. Run it before proposing a fix.

**When to run CodeGraph**:
- After the triage narrows the symptom to a specific camera sub-area (open / preview / capture / switch / flash / focus / device compatibility)
- When tracing the session lifecycle across Activity/Fragment/Compose lifecycle events
- When a fix may change how the camera is shared between screens (e.g., scan → preview → editor)

**How**:
```bash
codegraph explore "<camera-manager entry, e.g., CameraManager.openCamera call site>"
codegraph explore "<camera session / use-case handler class>"
codegraph explore "<ImageReader / capture call site>"
```

**What to look for from CodeGraph results (camera-focused)**:
- **Callers of `openCamera`** — which Activity/Fragment/ViewModel lifecycle events trigger opening; paired with which callers trigger close.
- **Capture session lifecycle** — callers of `createCaptureSession` and `setRepeatingRequest`; any caller that submits requests without waiting for `onConfigured` is suspect.
- **Surface owner chain** — from `SurfaceTexture`/`TextureView`/`PreviewView` through attach to the session. Missing attach or early detach = black preview.
- **ImageReader lifecycle** — every call site of `onImageAvailable` must have a guaranteed `image.close()` path; any early-return without close leaks.
- **Camera-switch flow** — the switch handler's sequence of stop/abort/close/reopen/rebind; out-of-order steps are the root cause of most switch freezes.
- **HandlerThread / Executor** — who holds the background thread used for camera callbacks; leaked threads appear here.
- **Downstream impact** — other screens that share camera state (preview → editor → share flow); a fix in one may break the handoff in another.

**Scope note**: CodeGraph does not reliably index XML layouts, `AndroidManifest.xml`, or Gradle build scripts. For camera-permission issues or CameraX Gradle dependency mismatches, supplement with `rg`/`find` on `AndroidManifest.xml` and `build.gradle`.

**Fallback**: If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker. Fall back to `rg`/grep for openCamera / capture session / ImageReader call-site search.

## Guardrails
- Run the full triage classification before jumping to a code fix — camera bugs are disproportionately driven by session lifecycle + device hardware capability.
- Always pair every `openCamera` with a confirmed `close`, and every `createCaptureSession` with a confirmed `close` — unmatched pairs are the #1 root cause.
- Always call `image.close()` on every `ImageReader` image, including on error/early-return paths.
- Always query `CameraCharacteristics` per-camerId — never assume rear-camera capabilities apply to front.
- Always degrade gracefully for `LIMITED` / `LEGACY` hardware level devices rather than crashing on missing capabilities.
- Always test on at least two devices from different OEMs — camera HAL differences are the dominant source of "works on my device".
- Always verify camera behavior across `onPause`/`onResume`, `onStop`/`onStart`, and screen rotation — camera bugs hide in lifecycle gaps.
- Never log full `CaptureRequest` payloads, camera IDs combined with device serial, or image bytes — redact to the request template and `cameraId` alone.
- Do not mask `CameraAccessException` / `IllegalStateException` from session/device calls — surface them with a user-visible retry path.
- If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker. Fall back to `rg`/grep.