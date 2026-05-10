import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sluggify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generates a unique slug for a given table and name.
 * Appends an incremental digit if the slug is already taken.
 */
export async function generateUniqueSlug(
  supabase: any,
  name: string,
  table: string,
  currentId?: string
) {
  const baseSlug = sluggify(name);
  let slug = baseSlug;
  let isUnique = false;
  let counter = 0;

  while (!isUnique) {
    const checkSlug = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;
    
    const { data } = await supabase
      .from(table)
      .select("id")
      .eq("slug", checkSlug)
      .maybeSingle();

    if (!data || (currentId && data.id === currentId)) {
      isUnique = true;
      slug = checkSlug;
    } else {
      counter++;
      // Safety break to prevent infinite loops in case of unexpected DB issues
      if (counter > 100) {
        slug = `${baseSlug}-${Math.floor(Math.random() * 10000)}`;
        break;
      }
    }
  }

  return slug;
}
