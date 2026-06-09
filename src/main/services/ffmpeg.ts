import { exec } from 'child_process'

/**
 * Returns the width and height of a video using ffprobe.
 */
export function getVideoDimensions(filePath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const escapedPath = filePath.replace(/"/g, '\\"')
    exec(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${escapedPath}"`, (err, stdout) => {
      if (err) {
        console.error(`[ffmpeg] Error de ffprobe para dimensiones de ${filePath}:`, err)
        reject(err)
        return
      }
      const parts = stdout.trim().split('x')
      const width = parseInt(parts[0], 10)
      const height = parseInt(parts[1], 10)
      if (isNaN(width) || isNaN(height)) {
        reject(new Error('Invalid dimensions parsed from ffprobe: ' + stdout))
      } else {
        resolve({ width, height })
      }
    })
  })
}

/**
 * Returns the duration of a video in seconds using ffprobe.
 */
export function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    // Escape double quotes in path for windows/powershell compatibility
    const escapedPath = filePath.replace(/"/g, '\\"')
    exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${escapedPath}"`, (err, stdout) => {
      if (err) {
        console.error(`[ffmpeg] Error de ffprobe para ${filePath}:`, err)
        resolve(5) // default fallback 5 seconds
        return
      }
      const dur = parseFloat(stdout.trim())
      resolve(isNaN(dur) ? 5 : dur)
    })
  })
}

/**
 * Extracts a frame from a video at 0.5s (or 0.0s if 0.5s fails) to use as thumbnail.
 */
export function generateVideoThumbnail(videoPath: string, thumbnailPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const escapedVideo = videoPath.replace(/"/g, '\\"')
    const escapedThumb = thumbnailPath.replace(/"/g, '\\"')
    
    // Create thumbnail at 0.5s or start of video
    exec(`ffmpeg -y -ss 0.5 -i "${escapedVideo}" -vframes 1 -f image2 "${escapedThumb}"`, (err) => {
      if (err) {
        // Retry at 0.0s if 0.5s fails (e.g. video is very short)
        exec(`ffmpeg -y -ss 0.0 -i "${escapedVideo}" -vframes 1 -f image2 "${escapedThumb}"`, (err2) => {
          if (err2) {
            reject(err2)
          } else {
            resolve()
          }
        })
      } else {
        resolve()
      }
    })
  })
}

/**
 * Formats a duration in seconds into a "M:SS" string.
 */
export function formatTimeMinutesSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}
