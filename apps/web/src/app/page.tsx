import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Support Project</h1>
      <p className="mt-4">
        <Link href="/login" className="text-blue-600 hover:underline">
          Log in
        </Link>{" "}
        |{" "}
        <Link href="/signup" className="text-blue-600 hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
