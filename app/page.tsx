import Navbar from "@/components/Navbar";
import Board from "@/components/Board";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <Board />
    </div>
  );
}
