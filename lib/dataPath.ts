export const getDatasetPath = (relativePath: string) => {
  const cleanedPath = relativePath.replace(/^\/+/, "");
  const variant = process.env.NEXT_PUBLIC_DATA_VARIANT === "dummy" ? "dummy" : "real";

  return variant === "dummy" ? `/data-dummy/${cleanedPath}` : `/data/${cleanedPath}`;
};

export const getDatasetFallbackPath = (relativePath: string) => {
  const cleanedPath = relativePath.replace(/^\/+/, "");
  const variant = process.env.NEXT_PUBLIC_DATA_VARIANT === "dummy" ? "dummy" : "real";

  return variant === "dummy" ? `/data/${cleanedPath}` : `/data-dummy/${cleanedPath}`;
};

export const fetchDatasetJson = async <T>(
  relativePath: string,
  init?: RequestInit,
): Promise<T> => {
  const primary = getDatasetPath(relativePath);
  const fallback = getDatasetFallbackPath(relativePath);

  let response = await fetch(primary, init);
  if (!response.ok) {
    response = await fetch(fallback, init);
  }
  if (!response.ok) {
    throw new Error(`Failed to load dataset (${response.status} ${response.statusText})`);
  }
  return (await response.json()) as T;
};
