// file: ascii.ts

import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

class asciiHandler implements FormatHandler {

  public name: string = "ascii";
  public supportedFormats?: FileFormat[];
  public ready: boolean = false;
  #canvas?: HTMLCanvasElement;
  #ctx?: CanvasRenderingContext2D;
  async init () {
    this.supportedFormats = [
      {
        name: "Portable Network Graphics",
        format: "png",
        extension: "png",
        mime: "image/png",
        from: true,
        to: true,
        internal: "png"
      },
      {
        name: "ascii",
        format: "textAscii",
        extension: "txt",
        mime: "text/plain",
        from: true,
        to: true,
        internal: "txt"
      },
      {
        name: "asciiColored",
        format: "textColor",
        extension: "txtColor",
        mime: "text/x-colored-text",
        from: true,
        to: true,
        internal: "txtColor"
      },
      {
        name: "ascii limited size",
        format: "textLimited",
        extension: "txtLimited",
        mime: "text/plain-limited",
        from: false,
        to: true,
        internal: "txtLimited"
      },
      {
        name: "asciiColored limited size",
        format: "textColorLimited",
        extension: "txtColorLimited",
        mime: "text/x-colored-text-limited",
        from: false,
        to: true,
        internal: "txtColorLimited"
      }
    ];
    this.#canvas = document.createElement("canvas");
    this.#ctx = this.#canvas.getContext("2d") || undefined;
    this.ready = true;
  }
  textToCanvas (text: string, color = false) {
    if (!this.#canvas || !this.#ctx) {
      throw "Handler not initialized.";
    }
    const charPalette = [" ", ".", ":", "-", "=", "+", "*", "#", "%", "@"];
    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
    const lines = text.split("\n");
    const visibleLines = color ? lines.map(stripAnsi) : lines;
    const width = Math.max(0, ...visibleLines.map(line => line.length));
    const height = lines.length;

    this.#canvas.width = width;
    this.#canvas.height = height;

    if (color) {
      const ansiPrefix = "\x1b[38;2;";
      const resetSeq = "\x1b[0m";
      for (let y = 0; y < height; y++) {
        const line = lines[y];
        let x = 0;
        let i = 0;

        while (x < width && i < line.length) {
          if (line.startsWith(ansiPrefix, i)) {
            const mIndex = line.indexOf("m", i + ansiPrefix.length);
            if (mIndex !== -1) {
              const colorStr = line.slice(i + ansiPrefix.length, mIndex);
              const parts = colorStr.split(";");
              const r = Number(parts[0]) || 0;
              const g = Number(parts[1]) || 0;
              const b = Number(parts[2]) || 0;
              const char = line[mIndex + 1] || " ";
              this.#ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
              this.#ctx.fillRect(x, y, 1, 1);
              x++;
              i = mIndex + 2;
              if (line.startsWith(resetSeq, i)) {
                i += resetSeq.length;
              }
              continue;
            }
          }
          this.#ctx.fillStyle = "rgb(255, 255, 255)";
          this.#ctx.fillRect(x, y, 1, 1);
          x++;
          i++;
        }

        for (; x < width; x++) {
          this.#ctx.fillStyle = "rgb(255, 255, 255)";
          this.#ctx.fillRect(x, y, 1, 1);
        }
      }
      return;
    }

    for (let y = 0; y < height; y++) {
      const line = lines[y];
      for (let x = 0; x < width; x++) {
        const char = line[x] || " ";
        const charIndex = charPalette.indexOf(char);
        if (charIndex === -1) {
          this.#ctx.fillStyle = "rgb(255, 255, 255)";
        } else {
          const brightness = (charIndex / (charPalette.length - 1)) * 255;
          this.#ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
        }
        this.#ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  canvasToText (color = false, limited = false): string {
    if (!this.#canvas || !this.#ctx) {
      throw "Handler not initialized.";
    }
    const charPalette = [" ", ".", ":", "-", "=", "+", "*", "#", "%", "@"];
    let asciiStr = "";
    if (limited) {
      const imageData = this.#ctx.getImageData(0, 0, this.#canvas.width, this.#canvas.height);
      const maxWidth = 100;
      const maxHeight = 100;
      // Compute resize ratio
      const ratio = Math.min(maxWidth / imageData.width, maxHeight / imageData.height);
      const newWidth = Math.floor(imageData.width * ratio);
      const newHeight = Math.floor(imageData.height * ratio);
      // Create a temporary canvas for resizing
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCanvas.width = newWidth;
      tempCanvas.height = newHeight;
      // Resize the image
      tempCtx.drawImage(this.#canvas, 0, 0, imageData.width, imageData.height, 0, 0, newWidth, newHeight);
      // Read resized image data
      const resizedImageData = tempCtx.getImageData(0, 0, newWidth, newHeight);
      // Replace original image with resized version
      this.#canvas.width = newWidth;
      this.#canvas.height = newHeight;
      this.#ctx.putImageData(resizedImageData, 0, 0);
      // Cleanup temporary canvas
      tempCanvas.width = 0;
      tempCanvas.height = 0;
    }
    const imageData = this.#ctx.getImageData(0, 0, this.#canvas.width, this.#canvas.height);
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const index = (y * imageData.width + x) * 4;
        const r = imageData.data[index];
        const g = imageData.data[index + 1];
        const b = imageData.data[index + 2];
        const avg = (r + g + b) / 3;
        const charIndex = Math.floor((avg / 255) * (charPalette.length - 1));
        if (color) {
          asciiStr += `\x1b[38;2;${r};${g};${b}m@\x1b[0m`;
        } else {
          asciiStr += charPalette[charIndex];
        }
      }
      asciiStr += "\n";
    }
    return asciiStr;
  }
  async doConvert (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {
    if (!this.#canvas || !this.#ctx) {
      throw "Handler not initialized.";
    }
    const outputFiles: FileData[] = [];
    for (const inputFile of inputFiles) {
      if (inputFormat.format === "png") {
        const img = new Image();
        const blob = new Blob([inputFile.bytes as BlobPart], { type: inputFormat.mime });
        const url = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
          img.addEventListener("load", resolve);
          img.addEventListener("error", reject);
          img.src = url;
        });
        this.#canvas.width = img.naturalWidth;
        this.#canvas.height = img.naturalHeight;
        this.#ctx.drawImage(img, 0, 0);
      } else {
        // Convert text to image
        const text = new TextDecoder().decode(inputFile.bytes);
        this.textToCanvas(text, inputFormat.format.startsWith("textColor"));
      }
      // Convert the canvas to text or image depending on output format
      if (outputFormat.format === "png") {
        const bytes: Uint8Array = await new Promise((resolve, reject) => {
          this.#canvas!.toBlob((blob) => {
            if (!blob) return reject("Canvas output failed");
            blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
          }, outputFormat.mime);
        });
        outputFiles.push({
          name: inputFile.name.replace(/\.[^/.]+$/, "") + ".png",
          bytes: bytes
        });
      } else {
        const asciiStr = this.canvasToText(
          outputFormat.format.startsWith("textColor"),
          outputFormat.format.endsWith("Limited")
        );
        const asciiBytes = new TextEncoder().encode(asciiStr);
        outputFiles.push({
          name: inputFile.name.replace(/\.[^/.]+$/, "") + (outputFormat.format.endsWith("Limited") ? "_limited" : "") + (outputFormat.format.startsWith("textColor") ? "_colored" : "") + ".txt",
          bytes: asciiBytes
        });
      }
    }
    return outputFiles;
  }

}

export default asciiHandler;