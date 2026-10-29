#import <AVFoundation/AVFoundation.h>
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>
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

// Captures only fpasoterm's own NSWindow. It is called on the AppKit main
// thread by the narrow Rust command and never enumerates or selects another
// application's window. The PNG result keeps the existing Rust/AVFoundation
// writer boundary intact while preserving native popup controls that a canvas
// snapshot cannot represent.
int fpasoterm_macos_window_snapshot_png(void *windowHandle,
                                         uint8_t **outBytes,
                                         size_t *outLength,
                                         uint32_t *outWidth,
                                         uint32_t *outHeight,
                                         char **outError) {
  @autoreleasepool {
    if (outBytes == NULL || outLength == NULL || outWidth == NULL || outHeight == NULL) {
      fpasoterm_copy_error(outError, nil, @"Window capture output is unavailable");
      return 0;
    }
    *outBytes = NULL;
    *outLength = 0;
    *outWidth = 0;
    *outHeight = 0;
    if (windowHandle == NULL || ![NSThread isMainThread]) {
      fpasoterm_copy_error(outError, nil, @"fpasoterm window capture must run on the AppKit main thread");
      return 0;
    }
    NSWindow *window = (__bridge NSWindow *)windowHandle;
    CGWindowID windowId = (CGWindowID)[window windowNumber];
    if (windowId == 0) {
      fpasoterm_copy_error(outError, nil, @"fpasoterm window has no capture identifier");
      return 0;
    }
    CGImageRef image = CGWindowListCreateImage(
        CGRectNull,
        kCGWindowListOptionIncludingWindow,
        windowId,
        kCGWindowImageBoundsIgnoreFraming | kCGWindowImageShouldBeOpaque);
    if (image == NULL) {
      fpasoterm_copy_error(outError, nil, @"macOS could not capture the fpasoterm window; allow Screen Recording if requested");
      return 0;
    }
    size_t imageWidth = CGImageGetWidth(image);
    size_t imageHeight = CGImageGetHeight(image);
    // H.264 needs even dimensions. Crop one trailing pixel rather than
    // rescaling the titlebar or remote-desktop pixels.
    size_t width = imageWidth - (imageWidth % 2);
    size_t height = imageHeight - (imageHeight % 2);
    if (width < 2 || height < 2 || width > UINT32_MAX || height > UINT32_MAX) {
      CGImageRelease(image);
      fpasoterm_copy_error(outError, nil, @"fpasoterm window capture has invalid dimensions");
      return 0;
    }
    CGImageRef cropped = CGImageCreateWithImageInRect(image, CGRectMake(0, 0, width, height));
    CGImageRelease(image);
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
}

void fpasoterm_macos_window_snapshot_free(uint8_t *bytes) {
  free(bytes);
}
