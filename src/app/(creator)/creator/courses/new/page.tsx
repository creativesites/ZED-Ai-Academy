import { NewCourseForm } from "@/components/creator/new-course-form";

export const metadata = { title: "New Course — Creator" };

export default function NewCoursePage() {
  return (
    <div className="container max-w-7xl px-4 py-6 sm:py-10">
      <NewCourseForm />
    </div>
  );
}
