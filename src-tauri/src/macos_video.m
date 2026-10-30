#import <AVFoundation/AVFoundation.h>
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>
#import <WebKit/WebKit.h>
#import <dispatch/dispatch.h>

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

// This deliberately narrow bridge receives already-rendered terminal frames.
// It never captures a screen, asks for a permission, or observes another app.
// AVFoundation owns H.264 compression and the MPEG-4 container, avoiding the
// black CanvasCaptureMediaStream frames emitted by some Intel WKWebViews.
@interface FpasotermMp4Writer : NSObject
@property(nonatomic, strong) AVAssetWriter *assetWriter;
@property(nonatomic, strong) AVAssetWriterInput *input;
@property(nonatomic, strong) AVAssetWriterInputPixelBufferAdaptor *adaptor;
@property(nonatomic, assign) uint32_t width;
@property(nonatomic, assign) uint32_t height;
@property(nonatomic, assign) uint32_t framesPerSecond;
@property(nonatomic, assign) BOOL finished;
- (instancetype)initWithPath:(NSString *)path
                       width:(uint32_t)width
                      height:(uint32_t)height
             framesPerSecond:(uint32_t)framesPerSecond
                       error:(NSError **)error;
- (BOOL)appendRgba:(const uint8_t *)pixels
             length:(size_t)length
         frameIndex:(uint64_t)frameIndex
              error:(NSError **)error;
- (BOOL)finishWithError:(NSError **)error;
@end

@implementation FpasotermMp4Writer

- (instancetype)initWithPath:(NSString *)path
                       width:(uint32_t)width
                      height:(uint32_t)height
             framesPerSecond:(uint32_t)framesPerSecond
                       error:(NSError **)error {
  if (width == 0 || height == 0 || framesPerSecond == 0 || width % 2 != 0 || height % 2 != 0) {
    if (error != NULL) {
      *error = [NSError errorWithDomain:@"fpasoterm.video"
                                    code:1
                                userInfo:@{NSLocalizedDescriptionKey: @"MP4 video dimensions must be positive even values and FPS must be positive"}];
    }
    return nil;
  }
  self = [super init];
  if (self == nil) {
    return nil;
  }

  NSURL *url = [NSURL fileURLWithPath:path];
  // Rust reserves a unique name with create_new first. AVAssetWriter requires
  // that its output not exist, so release that empty reservation immediately
  // before opening the writer.
  [[NSFileManager defaultManager] removeItemAtURL:url error:nil];
  NSError *writerError = nil;
  _assetWriter = [[AVAssetWriter alloc] initWithURL:url
                                             fileType:AVFileTypeMPEG4
                                                error:&writerError];
  if (_assetWriter == nil) {
    if (error != NULL) {
      *error = writerError;
    }
    return nil;
  }

  NSDictionary *compression = @{
    AVVideoAverageBitRateKey: @(4 * 1000 * 1000),
    AVVideoMaxKeyFrameIntervalKey: @(MAX(1, framesPerSecond * 2)),
  };
  NSDictionary *videoSettings = @{
    AVVideoCodecKey: AVVideoCodecTypeH264,
    AVVideoWidthKey: @(width),
    AVVideoHeightKey: @(height),
    AVVideoCompressionPropertiesKey: compression,
  };
  _input = [[AVAssetWriterInput alloc] initWithMediaType:AVMediaTypeVideo
                                           outputSettings:videoSettings];
  _input.expectsMediaDataInRealTime = YES;
  NSDictionary *pixelAttributes = @{
    (NSString *)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA),
    (NSString *)kCVPixelBufferWidthKey: @(width),
    (NSString *)kCVPixelBufferHeightKey: @(height),
    (NSString *)kCVPixelBufferIOSurfacePropertiesKey: @{},
  };
  _adaptor = [[AVAssetWriterInputPixelBufferAdaptor alloc]
      initWithAssetWriterInput:_input
      sourcePixelBufferAttributes:pixelAttributes];
  if (![_assetWriter canAddInput:_input]) {
    if (error != NULL) {
      *error = [NSError errorWithDomain:@"fpasoterm.video"
                                    code:2
                                userInfo:@{NSLocalizedDescriptionKey: @"AVAssetWriter rejected the H.264 video input"}];
    }
    return nil;
  }
  [_assetWriter addInput:_input];
  if (![_assetWriter startWriting]) {
    if (error != NULL) {
      *error = _assetWriter.error ?: [NSError errorWithDomain:@"fpasoterm.video"
                                                          code:3
                                                      userInfo:@{NSLocalizedDescriptionKey: @"AVAssetWriter could not start MP4 recording"}];
    }
    return nil;
  }
  [_assetWriter startSessionAtSourceTime:kCMTimeZero];
  _width = width;
  _height = height;
  _framesPerSecond = framesPerSecond;
  _finished = NO;
  return self;
}

- (BOOL)appendRgba:(const uint8_t *)pixels
             length:(size_t)length
         frameIndex:(uint64_t)frameIndex
              error:(NSError **)error {
  if (_finished || pixels == NULL) {
    if (error != NULL) {
      *error = [NSError errorWithDomain:@"fpasoterm.video"
                                    code:4
                                userInfo:@{NSLocalizedDescriptionKey: @"MP4 recording is closed or frame data is unavailable"}];
    }
    return NO;
  }
  uint64_t expected = (uint64_t)_width * (uint64_t)_height * 4;
  if (length != expected) {
    if (error != NULL) {
      *error = [NSError errorWithDomain:@"fpasoterm.video"
                                    code:5
                                userInfo:@{NSLocalizedDescriptionKey: @"MP4 RGBA frame does not match the recording geometry"}];
    }
    return NO;
  }
  // A five-fps terminal recorder should rarely apply backpressure. Wait for a
  // bounded interval rather than dropping the first/final frame silently.
  for (NSUInteger wait = 0; !_input.readyForMoreMediaData && wait < 100; wait += 1) {
    [NSThread sleepForTimeInterval:0.01];
  }
  if (!_input.readyForMoreMediaData) {
    if (error != NULL) {
      *error = _assetWriter.error ?: [NSError errorWithDomain:@"fpasoterm.video"
                                                          code:6
                                                      userInfo:@{NSLocalizedDescriptionKey: @"MP4 encoder did not accept a terminal frame in time"}];
    }
    return NO;
  }

  CVPixelBufferRef buffer = NULL;
  CVReturn bufferResult = CVPixelBufferPoolCreatePixelBuffer(NULL, _adaptor.pixelBufferPool, &buffer);
  if (bufferResult != kCVReturnSuccess || buffer == NULL) {
    if (error != NULL) {
      *error = [NSError errorWithDomain:@"fpasoterm.video"
                                    code:7
                                userInfo:@{NSLocalizedDescriptionKey: @"AVFoundation could not allocate an MP4 pixel buffer"}];
    }
    return NO;
  }
  CVPixelBufferLockBaseAddress(buffer, 0);
  uint8_t *destination = (uint8_t *)CVPixelBufferGetBaseAddress(buffer);
  size_t destinationStride = CVPixelBufferGetBytesPerRow(buffer);
  size_t sourceStride = (size_t)_width * 4;
  for (uint32_t row = 0; row < _height; row += 1) {
    const uint8_t *sourceRow = pixels + (size_t)row * sourceStride;
    uint8_t *destinationRow = destination + (size_t)row * destinationStride;
    for (uint32_t column = 0; column < _width; column += 1) {
      size_t offset = (size_t)column * 4;
      // Canvas and image::RgbaImage use RGBA; AVFoundation's pixel pool is BGRA.
      destinationRow[offset] = sourceRow[offset + 2];
      destinationRow[offset + 1] = sourceRow[offset + 1];
      destinationRow[offset + 2] = sourceRow[offset];
      destinationRow[offset + 3] = sourceRow[offset + 3];
    }
  }
  CVPixelBufferUnlockBaseAddress(buffer, 0);
  CMTime presentationTime = CMTimeMake((int64_t)frameIndex, (int32_t)_framesPerSecond);
  BOOL appended = [_adaptor appendPixelBuffer:buffer withPresentationTime:presentationTime];
  CVPixelBufferRelease(buffer);
  if (!appended && error != NULL) {
    *error = _assetWriter.error ?: [NSError errorWithDomain:@"fpasoterm.video"
                                                        code:8
                                                    userInfo:@{NSLocalizedDescriptionKey: @"AVFoundation rejected an MP4 terminal frame"}];
  }
  return appended;
}

- (BOOL)finishWithError:(NSError **)error {
  if (_finished) {
    return YES;
  }
  _finished = YES;
  [_input markAsFinished];
  dispatch_semaphore_t finished = dispatch_semaphore_create(0);
  [_assetWriter finishWritingWithCompletionHandler:^{
    dispatch_semaphore_signal(finished);
  }];
  long waitResult = dispatch_semaphore_wait(
      finished,
      dispatch_time(DISPATCH_TIME_NOW, (int64_t)(20 * NSEC_PER_SEC)));
  if (waitResult != 0 || _assetWriter.status != AVAssetWriterStatusCompleted) {
    if (error != NULL) {
      *error = _assetWriter.error ?: [NSError errorWithDomain:@"fpasoterm.video"
                                                          code:9
                                                      userInfo:@{NSLocalizedDescriptionKey: @"AVFoundation did not finalize the MP4 recording"}];
    }
    return NO;
  }
  return YES;
}

- (void)dealloc {
  if (!_finished) {
    [_assetWriter cancelWriting];
  }
}

@end

static void fpasoterm_copy_error(char **outError, NSError *error, NSString *fallback) {
  if (outError == NULL) {
    return;
  }
  *outError = NULL;
  NSString *message = error.localizedDescription ?: fallback;
  const char *utf8 = message.UTF8String;
  if (utf8 != NULL) {
    *outError = strdup(utf8);
  }
}

void *fpasoterm_macos_mp4_writer_create(const char *path,
                                         uint32_t width,
                                         uint32_t height,
                                         uint32_t framesPerSecond,
                                         char **outError) {
  @autoreleasepool {
    if (path == NULL) {
      fpasoterm_copy_error(outError, nil, @"MP4 recording path is unavailable");
      return NULL;
    }
    NSString *filePath = [[NSString alloc] initWithUTF8String:path];
    NSError *error = nil;
    FpasotermMp4Writer *writer = [[FpasotermMp4Writer alloc] initWithPath:filePath
                                                                      width:width
                                                                     height:height
                                                            framesPerSecond:framesPerSecond
                                                                      error:&error];
    if (writer == nil) {
      fpasoterm_copy_error(outError, error, @"AVFoundation could not start MP4 recording");
      return NULL;
    }
    return (__bridge_retained void *)writer;
  }
}

int fpasoterm_macos_mp4_writer_append(void *handle,
                                       const uint8_t *pixels,
                                       size_t length,
                                       uint64_t frameIndex,
                                       char **outError) {
  @autoreleasepool {
    if (handle == NULL) {
      fpasoterm_copy_error(outError, nil, @"MP4 recording handle is unavailable");
      return 0;
    }
    FpasotermMp4Writer *writer = (__bridge FpasotermMp4Writer *)handle;
    NSError *error = nil;
    BOOL result = [writer appendRgba:pixels length:length frameIndex:frameIndex error:&error];
    if (!result) {
      fpasoterm_copy_error(outError, error, @"AVFoundation could not append an MP4 frame");
    }
    return result ? 1 : 0;
  }
}

int fpasoterm_macos_mp4_writer_finish(void *handle, char **outError) {
  @autoreleasepool {
    if (handle == NULL) {
      fpasoterm_copy_error(outError, nil, @"MP4 recording handle is unavailable");
      return 0;
    }
    FpasotermMp4Writer *writer = (__bridge FpasotermMp4Writer *)handle;
    NSError *error = nil;
    BOOL result = [writer finishWithError:&error];
    if (!result) {
      fpasoterm_copy_error(outError, error, @"AVFoundation could not finalize MP4 recording");
    }
    return result ? 1 : 0;
  }
}

void fpasoterm_macos_mp4_writer_destroy(void *handle) {
  @autoreleasepool {
    if (handle != NULL) {
      CFBridgingRelease(handle);
    }
  }
}

void fpasoterm_macos_mp4_error_free(char *message) {
  free(message);
}

// Encodes one AppKit-owned image to the bounded PNG payload consumed by Rust.
// The caller retains ownership of `image`; this helper never observes a
// display or another application.
static int fpasoterm_macos_encode_window_png(CGImageRef image,
                                              uint8_t **outBytes,
                                              size_t *outLength,
                                              uint32_t *outWidth,
                                              uint32_t *outHeight,
                                              char **outError) {
  if (image == NULL) {
    fpasoterm_copy_error(outError, nil, @"macOS window image is unavailable");
    return 0;
  }
  size_t imageWidth = CGImageGetWidth(image);
  size_t imageHeight = CGImageGetHeight(image);
  // H.264 needs even dimensions. Crop one trailing pixel rather than
  // rescaling the titlebar or remote-desktop pixels.
  size_t width = imageWidth - (imageWidth % 2);
  size_t height = imageHeight - (imageHeight % 2);
  if (width < 2 || height < 2 || width > UINT32_MAX || height > UINT32_MAX) {
    fpasoterm_copy_error(outError, nil, @"fpasoterm window capture has invalid dimensions");
    return 0;
  }
  CGImageRef cropped = CGImageCreateWithImageInRect(image, CGRectMake(0, 0, width, height));
  if (cropped == NULL) {
    fpasoterm_copy_error(outError, nil, @"macOS could not crop the fpasoterm window capture");
    return 0;
  }
  NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithCGImage:cropped];
  CGImageRelease(cropped);
  NSData *png = [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
  if (png == nil || png.length == 0) {
    fpasoterm_copy_error(outError, nil, @"macOS could not encode the fpasoterm window capture as PNG");
    return 0;
  }
  uint8_t *bytes = malloc(png.length);
  if (bytes == NULL) {
    fpasoterm_copy_error(outError, nil, @"macOS could not allocate the fpasoterm window capture");
    return 0;
  }
  memcpy(bytes, png.bytes, png.length);
  *outBytes = bytes;
  *outLength = png.length;
  *outWidth = (uint32_t)width;
  *outHeight = (uint32_t)height;
  return 1;
}

// The WebKit snapshot completion is asynchronous. The Rust caller owns the
// returned bytes/error and releases them through the matching bridge helpers.
typedef void (*FpasotermWindowSnapshotCallback)(uint8_t *bytes,
                                                size_t length,
                                                uint32_t width,
                                                uint32_t height,
                                                char *error,
                                                void *context);

static void fpasoterm_window_snapshot_complete_error(FpasotermWindowSnapshotCallback callback,
                                                      void *context,
                                                      NSError *error,
                                                      NSString *fallback) {
  char *message = NULL;
  fpasoterm_copy_error(&message, error, fallback);
  callback(NULL, 0, 0, 0, message, context);
}

static void fpasoterm_window_snapshot_complete_image(FpasotermWindowSnapshotCallback callback,
                                                      void *context,
                                                      CGImageRef image) {
  uint8_t *bytes = NULL;
  size_t length = 0;
  uint32_t width = 0;
  uint32_t height = 0;
  char *error = NULL;
  if (fpasoterm_macos_encode_window_png(
          image, &bytes, &length, &width, &height, &error) == 0) {
    callback(NULL, 0, 0, 0, error, context);
    return;
  }
  callback(bytes, length, width, height, NULL, context);
}

static WKWebView *fpasoterm_find_web_view(NSView *view) {
  if (view == nil) {
    return nil;
  }
  if ([view isKindOfClass:[WKWebView class]]) {
    return (WKWebView *)view;
  }
  for (NSView *subview in view.subviews) {
    WKWebView *webView = fpasoterm_find_web_view(subview);
    if (webView != nil) {
      return webView;
    }
  }
  return nil;
}

static void fpasoterm_window_snapshot_content_view(NSView *contentView,
                                                    FpasotermWindowSnapshotCallback callback,
                                                    void *context) {
  if (contentView == nil) {
    fpasoterm_window_snapshot_complete_error(
        callback, context, nil, @"macOS could not access the fpasoterm window content view");
    return;
  }
  NSRect bounds = contentView.bounds;
  if (NSIsEmptyRect(bounds)) {
    fpasoterm_window_snapshot_complete_error(
        callback, context, nil, @"macOS fpasoterm window content view has empty bounds");
    return;
  }
  NSBitmapImageRep *contentBitmap = [contentView bitmapImageRepForCachingDisplayInRect:bounds];
  if (contentBitmap == nil) {
    fpasoterm_window_snapshot_complete_error(
        callback, context, nil, @"macOS could not allocate a fpasoterm content snapshot");
    return;
  }
  [contentView cacheDisplayInRect:bounds toBitmapImageRep:contentBitmap];
  fpasoterm_window_snapshot_complete_image(callback, context, contentBitmap.CGImage);
}

// Captures fpasoterm's own WebKit view first, then falls back to its AppKit
// content view if a WebKit snapshot cannot be produced. `cacheDisplayInRect`
// can be black for a process-isolated WKWebView on Intel macOS; WebKit's own
// snapshot API asks that rendering process for its visible pixels instead.
// This is called on the AppKit main thread, never enumerates another window,
// and does not use screen-capture APIs or require Screen Recording permission.
void fpasoterm_macos_window_snapshot_png_async(void *windowHandle,
                                                FpasotermWindowSnapshotCallback callback,
                                                void *context) {
  @autoreleasepool {
    if (callback == NULL) {
      return;
    }
    if (windowHandle == NULL || ![NSThread isMainThread]) {
      fpasoterm_window_snapshot_complete_error(
          callback, context, nil, @"fpasoterm window capture must run on the AppKit main thread");
      return;
    }
    NSWindow *window = (__bridge NSWindow *)windowHandle;
    NSView *contentView = window.contentView;
    WKWebView *webView = fpasoterm_find_web_view(contentView);
    if (webView == nil || NSIsEmptyRect(webView.bounds)) {
      fpasoterm_window_snapshot_content_view(contentView, callback, context);
      return;
    }
    WKSnapshotConfiguration *configuration = [[WKSnapshotConfiguration alloc] init];
    configuration.rect = webView.bounds;
    [webView takeSnapshotWithConfiguration:configuration
                         completionHandler:^(NSImage *image, NSError *error) {
      if (image == nil || error != nil) {
        // Keep a narrow AppKit fallback for an early WebKit startup race. It
        // can omit a remote layer, but still captures native terminal chrome.
        fpasoterm_window_snapshot_content_view(contentView, callback, context);
        return;
      }
      NSRect proposedRect = NSMakeRect(0, 0, image.size.width, image.size.height);
      CGImageRef cgImage = [image CGImageForProposedRect:&proposedRect context:nil hints:nil];
      if (cgImage == NULL) {
        fpasoterm_window_snapshot_content_view(contentView, callback, context);
        return;
      }
      fpasoterm_window_snapshot_complete_image(callback, context, cgImage);
    }];
  }
}

void fpasoterm_macos_window_snapshot_free(uint8_t *bytes) {
  free(bytes);
}
