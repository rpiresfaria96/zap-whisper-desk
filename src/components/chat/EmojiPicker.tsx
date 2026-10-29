import { useState } from "react";

const categories: Record<string, string[]> = {
  "Rostos": "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😮 😯 😲 🥱 😴 🤤 😪 😵 😵‍💫 🤯 🥳 😎 🤓 🧐 😕 🙁 ☹️ 😟 😔 😞 😖 😣 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 😱 😨 😰 😥 😓 🤒 🤕 🤢 🤮 🤧 😷 🤠 😈 👿 👻 💀 👽 🤖".split(" "),
  "Gestos": "👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 🦾 🖕 💅 🤳 🫶 🫰 🫵".split(" "),
  "Corações": "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 😍 🥰 💌 💋 🫂".split(" "),
  "Animais": "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦆 🦅 🦉 🦋 🐛 🐝 🐞 🐢 🐍 🦎 🐙 🦀 🐠 🐟 🐬 🐳 🦈 🐘 🦒 🐪 🦓 🐎 🐕 🐈".split(" "),
  "Comidas": "🍎 🍏 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥕 🌽 🥔 🍞 🥐 🥨 🧀 🥚 🍳 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍝 🍜 🍣 🍤 🍚 🍛 🍦 🍩 🍪 🎂 🍰 🍫 🍬 🍭 ☕ 🍵 🧃 🥤 🍺 🍷".split(" "),
  "Objetos": "📱 💻 ⌨️ 🖥️ 🖨️ 📷 📸 🎥 📺 🎮 🎧 🎤 🎹 🎸 🥁 📚 📖 📝 ✏️ 📌 📍 📎 ✂️ 🔒 🔑 🗝️ 💡 🔦 🔋 📦 💊 🧹 🧽 🪑 🛏️ 🎁 🎈 🎉 🎊 💰 💳 📅 📞 ☎️ ✉️ 📧".split(" "),
  "Símbolos": "✅ ☑️ ❎ ❌ ❗ ❕ ❓ ❔ ‼️ ⁉️ ⚠️ ⛔ 🚫 ♻️ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🟩 🟦 ⬆️ ⬇️ ⬅️ ➡️ 🔝 🔜 🔚 🔙 🆗 🆘 🆕 🆓 🆒 💯 🔥 ⭐ 🌟 ✨ 🎯 🚀 🕐 🕒 🕘".split(" "),
  "Brasil": "🇧🇷 🇵🇹 🇺🇸 🇦🇷 🇺🇾 🇵🇾 🇨🇱 🇧🇴 🇨🇴 🇲🇽 🇪🇸 🇫🇷 🇮🇹 🇩🇪 🇬🇧 🇯🇵 🇰🇷 🇨🇳 🌎 🌍 🌏".split(" "),
};

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [category, setCategory] = useState("Rostos");
  const [search, setSearch] = useState("");
  const options = search ? Object.values(categories).flat() : categories[category] || categories["Rostos"];
  const selected = [...new Set(options)].filter((emoji) => !search ||
    emoji.includes(search) || category.toLowerCase().includes(search.toLowerCase()));
  return (
    <div role="dialog" aria-label="Selecionar emoji"
      className="absolute bottom-full left-2 z-40 mb-2 w-[min(355px,calc(100vw-30px))] rounded-xl border bg-popover p-3 shadow-xl">
      <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
        {Object.keys(categories).map((name) => (
          <button key={name} type="button" onClick={() => { setCategory(name); setSearch(""); }}
            className={`shrink-0 rounded px-2 py-1 text-xs ${category === name ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
            {name}
          </button>
        ))}
      </div>
      <div className="scroll-thin grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
        {selected.map((emoji) => (
          <button type="button" key={emoji} title={emoji}
            aria-label={`Inserir emoji ${emoji}`}
            className="flex h-9 w-9 items-center justify-center rounded text-[23px] hover:bg-selected"
            style={{ fontFamily: '"Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif' }}
            onClick={() => onPick(emoji)}>{emoji}</button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Emojis disponíveis conforme a versão do Windows.</p>
    </div>
  );
}
