import Sidebar from "@/components/layout/sidebar";
import ChatInterface from "@/components/chat/chat-interface";

export default function ChatPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  );
}
