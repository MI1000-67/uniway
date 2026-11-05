export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export function validateImage(file: { type: string; size: number }) {
  if (!IMAGE_TYPES.includes(file.type))
    return "Choose a JPEG, PNG, or WebP image.";
  if (file.size > 15 * 1024 * 1024)
    return "This image is too large. Choose an image under 15 MB.";
  if (file.size === 0)
    return "This image is empty. Please choose another file.";
  return null;
}
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("This image could not be read. Try a different file."));
    image.src = url;
  });
}
