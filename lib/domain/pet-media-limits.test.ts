import { describe, it, expect } from "vitest";
import { validateMediaFile, MAX_PHOTO_BYTES, MAX_VIDEO_BYTES } from "./pet-media-limits";

describe("validateMediaFile", () => {
  it("aceita foto dentro do limite", () => {
    expect(validateMediaFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES - 1 })).toBeNull();
  });

  it("rejeita foto acima do limite", () => {
    expect(validateMediaFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 })).toContain("grande");
  });

  it("rejeita formato de imagem não aceito", () => {
    expect(validateMediaFile({ type: "image/gif", size: 1000 })).toContain("Formato");
  });

  it("aceita vídeo dentro do limite", () => {
    expect(validateMediaFile({ type: "video/mp4", size: MAX_VIDEO_BYTES - 1 })).toBeNull();
  });

  it("rejeita vídeo acima do limite", () => {
    expect(validateMediaFile({ type: "video/mp4", size: MAX_VIDEO_BYTES + 1 })).toContain("grande");
  });

  it("rejeita formato de vídeo não aceito", () => {
    expect(validateMediaFile({ type: "video/avi", size: 1000 })).toContain("Formato");
  });

  it("rejeita tipo que não é nem imagem nem vídeo", () => {
    expect(validateMediaFile({ type: "application/pdf", size: 1000 })).toContain("foto ou vídeo");
  });
});
