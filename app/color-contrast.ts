export function contrastRatio(first: string, second: string): number | null {
  function luminance(color: string) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return null;
    const channels = [1, 3, 5].map(at => {
      const value = parseInt(color.slice(at, at + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const a = luminance(first), b = luminance(second);
  return a === null || b === null ? null : (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
