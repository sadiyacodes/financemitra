"use client";

import { UserProfile } from "../lib/types";
import { useRouter } from "next/navigation";
import usersData from "../data/users.json";

export default function UserSelector() {
  const users: UserProfile[] = usersData as UserProfile[];
  const router = useRouter();

  const handleSelect = (userId: string) => {
    localStorage.setItem("fm_userId", userId);
    router.push("/dashboard");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-10">
      {users.map(u => (
        <div key={u.id} onClick={() => handleSelect(u.id)} className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 cursor-pointer hover:border-teal-500 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{u.name}</h3>
              <p className="text-sm text-gray-500">{u.city}</p>
            </div>
            <span className="bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-full">{u.type.replace(/_/g, " ")}</span>
          </div>

          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 mt-1">
            Fuel tracking enabled
          </span>
          
          <div className="mt-4">
            <p className="text-sm font-medium mb-1">{u.savings_goal.label}</p>
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div className="bg-teal-500 h-2 rounded-full" style={{ width: `${Math.min((u.savings_goal.current / u.savings_goal.target) * 100, 100)}%` }}></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>₹{u.savings_goal.current}</span>
              <span>₹{u.savings_goal.target}</span>
            </div>
          </div>
          <p className="mt-4 text-xs italic text-gray-500">Pattern: {u.income_pattern.replace(/_/g, " ")}</p>
        </div>
      ))}
    </div>
  );
}
