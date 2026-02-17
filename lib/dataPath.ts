export const getDatasetPath = (relativePath: string) => {
  const cleanedPath = relativePath.replace(/^\/+/, "");
  const variant = process.env.NEXT_PUBLIC_DATA_VARIANT === "dummy" ? "dummy" : "real";

  return variant === "dummy"
    ? `/data-dummy/${cleanedPath}`
    : `/data/${cleanedPath}`;
};
