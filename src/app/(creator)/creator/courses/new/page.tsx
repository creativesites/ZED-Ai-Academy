import { NewCourseForm } from "@/components/creator/new-course-form";

export const metadata = { title: "New Course — Creator" };

export default function NewCoursePage() {
  return (
    <div className="container" style={{ paddingTop: "60px", paddingBottom: "80px" }}>
      <NewCourseForm />
    </div>
  );
}
