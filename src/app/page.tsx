import FileUpload from "./components/FileUpload";

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          Text File Validator
        </h1>
        <FileUpload />
      </main>
    </div>
  );
}
