/**
 * Utility functions for client-side image processing.
 */

/**
 * Resizes an image file to a maximum width or height while maintaining aspect ratio,
 * and compresses it to a target quality.
 * 
 * @param file - The original image File object
 * @param maxWidth - Maximum width in pixels (default: 2048)
 * @param maxHeight - Maximum height in pixels (default: 2048)
 * @param quality - Compression quality between 0 and 1 (default: 0.8)
 * @returns Promise resolving to a new File object (or the original if processing fails)
 */
export async function reduceImageSize(
  file: File,
  maxWidth = 2048,
  maxHeight = 2048,
  quality = 0.8
): Promise<File> {
  // Only process images
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Skip tiny files or GIFs (which lose animation when resized via canvas)
  if (file.size < 200 * 1024 || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.warn('[image-utils] Failed to get canvas context, returning original file');
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              console.warn('[image-utils] Failed to create blob, returning original file');
              resolve(file);
              return;
            }

            // Create a new File object from the blob
            const resizedFile = new File([blob], file.name, {
              type: 'image/jpeg', // Always convert to JPEG for consistent compression
              lastModified: Date.now(),
            });

            // Only return the resized file if it's actually smaller
            if (resizedFile.size < file.size) {
              console.log(`[image-utils] Reduced ${file.name}: ${(file.size / 1024).toFixed(0)}KB -> ${(resizedFile.size / 1024).toFixed(0)}KB`);
              resolve(resizedFile);
            } else {
              console.log(`[image-utils] Resized ${file.name} is not smaller, returning original`);
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        console.warn('[image-utils] Failed to load image, returning original file');
        resolve(file);
      };
    };
    reader.onerror = () => {
      console.warn('[image-utils] Failed to read file, returning original file');
      resolve(file);
    };
  });
}
