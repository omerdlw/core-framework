export const revalidated = [];

export function revalidatePath(path) {
  revalidated.push(path);
}

export function revalidateTag(tag) {
  revalidated.push(`tag:${tag}`);
}
