import UserSelector from "../components/UserSelector";

export default function Home() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 p-8 flex flex-col items-center justify-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-teal-600 mb-2">FinanceMitra</h1>
        <p className="text-gray-600 dark:text-gray-400">Select a mock profile to begin.</p>
      </div>
      <UserSelector />
    </main>
  );
}
