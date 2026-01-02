"use client";

import { useEffect, useState, useRef } from "react";
import { supabase, type Room, type Message } from "@/lib/supabase";

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [username, setUsername] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch rooms on mount
  useEffect(() => {
    async function fetchRooms() {
      const { data, error } = await supabase
        .from("chat_room")
        .select("*")
        .order("name");

      if (error) {
        console.error("Error fetching rooms:", error);
      } else {
        setRooms(data || []);
      }
      setIsLoading(false);
    }

    fetchRooms();
  }, []);

  // Fetch messages and subscribe to realtime when room changes
  useEffect(() => {
    if (!selectedRoom) {
      setMessages([]);
      return;
    }

    async function fetchMessages() {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", selectedRoom!.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
      } else {
        setMessages(data || []);
      }
    }

    fetchMessages();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`room-${selectedRoom.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${selectedRoom.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoom]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedRoom || !username.trim() || !newMessage.trim()) {
      return;
    }

    const { error } = await supabase.from("chat_messages").insert({
      room_id: selectedRoom.id,
      username: username.trim(),
      message: newMessage.trim(),
    });

    if (error) {
      console.error("Error sending message:", error);
    } else {
      setNewMessage("");
    }
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();

    if (!newRoomName.trim()) {
      return;
    }

    const { data, error } = await supabase
      .from("chat_room")
      .insert({ name: newRoomName.trim() })
      .select()
      .single();

    if (error) {
      console.error("Error creating room:", error);
    } else {
      setRooms((prev) => [...prev, data].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      ));
      setSelectedRoom(data);
      setNewRoomName("");
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Chat App
          </h1>
          <select
            value={selectedRoom?.id || ""}
            onChange={(e) => {
              const room = rooms.find((r) => r.id === Number(e.target.value));
              setSelectedRoom(room || null);
            }}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Select a room...</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
          <form onSubmit={handleCreateRoom} className="flex gap-1">
            <input
              type="text"
              placeholder="New room"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={!newRoomName.trim()}
              className="rounded-md bg-zinc-900 px-2 py-1.5 text-sm font-medium text-white disabled:bg-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:disabled:bg-zinc-700"
            >
              +
            </button>
          </form>
          <input
            type="text"
            placeholder="Your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="ml-auto rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-auto px-4 py-4">
        <div className="mx-auto max-w-3xl">
          {rooms.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4">
              <p className="text-zinc-500 dark:text-zinc-400">
                No rooms yet. Create one to get started!
              </p>
              <form onSubmit={handleCreateRoom} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Room name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={!newRoomName.trim()}
                  className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:bg-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:disabled:bg-zinc-700"
                >
                  Create Room
                </button>
              </form>
            </div>
          ) : !selectedRoom ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-zinc-500 dark:text-zinc-400">
                Select a room to start chatting
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-zinc-500 dark:text-zinc-400">
                No messages yet. Be the first to say something!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-900"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {msg.username}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                    {msg.message}
                  </p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Message input */}
      {selectedRoom && (
        <footer className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <form
            onSubmit={handleSendMessage}
            className="mx-auto flex max-w-3xl gap-2"
          >
            <input
              type="text"
              placeholder={
                username ? "Type a message..." : "Enter username first"
              }
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={!username.trim()}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={!username.trim() || !newMessage.trim()}
              className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:bg-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:disabled:bg-zinc-700"
            >
              Send
            </button>
          </form>
        </footer>
      )}
    </div>
  );
}
