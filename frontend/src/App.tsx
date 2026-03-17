import { useState, useRef, useEffect } from 'react';
import '@livekit/components-styles';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  PanelLeft, 
  Plus,
  Scale,
  Mic,
  Paperclip,
  Send,
  FileText,
  Shield,
  Gavel,
  BookOpen,
  Loader2,
  MessageSquare,
  MoreVertical,
  Trash2,
  Edit2,
  Copy,
  Check,
  Headphones,
  LogOut
} from 'lucide-react';

import { supabase } from './supabaseClient';
import Auth from './Auth';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: { _seconds: number, _nanoseconds: number } | string;
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Chat management state
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, conversationId: string | null }>({ visible: false, x: 0, y: 0, conversationId: null });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  // Voice Assistant state
  const [isVoiceAssistantOn, setIsVoiceAssistantOn] = useState(false);

  // Copy and TTS state
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [readingIndex, setReadingIndex] = useState<number | null>(null);

  // STT & TTS Refs
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
  }, []);

  // Manage Supabase Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Supabase session error:", error.message);
        // If the refresh token is invalid, clear the stale local storage session
        supabase.auth.signOut().catch(e => console.error(e));
      }
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-scroll to the bottom of the chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load conversation history on startup/login
  useEffect(() => {
    if (session?.user?.id) {
       fetchConversations();
    }
  }, [session?.user?.id]);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`https://saara13-final-year-project.hf.space/api/conversations/${session.user.id}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (e) {
      console.error("Failed to fetch conversations", e);
    }
  };

  const loadConversation = async (id: string) => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch(`https://saara13-final-year-project.hf.space/api/conversations/${session.user.id}/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        setCurrentConversationId(id);
      }
    } catch (e) {
      console.error("Failed to load conversation", e);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
  };

  // Chat management handlers
  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      conversationId: id
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ ...contextMenu, visible: false });
  };

  useEffect(() => {
    const handleClick = () => closeContextMenu();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const handleDeleteConversation = async (id: string | null) => {
    if (!id || !session?.user?.id) return;
    try {
      const res = await fetch(`https://saara13-final-year-project.hf.space/api/conversations/${session.user.id}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (currentConversationId === id) {
          startNewChat();
        }
      }
    } catch (e) {
      console.error("Failed to delete conversation", e);
    }
    closeContextMenu();
  };

  const handleDeleteAllConversations = async () => {
    if (!session?.user?.id) return;
    const confirmDelete = window.confirm("Are you sure you want to delete ALL chat history?");
    if (!confirmDelete) return;

    try {
      const res = await fetch(`https://saara13-final-year-project.hf.space/api/conversations/${session.user.id}`, { method: 'DELETE' });
      if (res.ok) {
        setConversations([]);
        startNewChat();
      }
    } catch (e) {
      console.error("Failed to delete all conversations", e);
    }
  };

  const startRenaming = (id: string | null, currentTitle: string) => {
    if (!id) return;
    setRenamingId(id);
    setRenameTitle(currentTitle);
    closeContextMenu();
  };

  const handleRenameSubmit = async (id: string) => {
    if (!session?.user?.id || !renameTitle.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      const res = await fetch(`https://saara13-final-year-project.hf.space/api/conversations/${session.user.id}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameTitle.trim() })
      });
      if (res.ok) {
        setConversations(prev => 
          prev.map(c => c.id === id ? { ...c, title: renameTitle.trim() } : c)
        );
      }
    } catch (e) {
      console.error("Failed to rename conversation", e);
    }
    setRenamingId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(id);
    } else if (e.key === 'Escape') {
      setRenamingId(null);
    }
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const promptText = input.trim();
    const userMessageContent = promptText || (selectedFile ? `Attached document: ${selectedFile.name}` : "");
    const userMessage: Message = { role: 'user', content: userMessageContent };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let body: string | FormData;
      let headers: HeadersInit = {};

      if (selectedFile) {
        const formData = new FormData();
        formData.append('userId', session.user.id);
        if (currentConversationId) {
          formData.append('conversationId', currentConversationId);
        }
        formData.append('prompt', promptText);
        formData.append('file', selectedFile);
        body = formData;
        setSelectedFile(null); // Clear after adding to formData
      } else {
        body = JSON.stringify({
          userId: session.user.id,
          conversationId: currentConversationId,
          prompt: promptText
        });
        headers = {
          'Content-Type': 'application/json',
        };
      }

      // Send to our new Node.js Express backend integrating Firebase + Ollama
      // Send to our new Node.js Express backend integrating Firebase + Ollama
      const response = await fetch('https://saara13-final-year-project.hf.space/api/chat', {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response from backend');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No streaming body available');

      const decoder = new TextDecoder('utf-8');
      let done = false;
      let assistantMessageContent = '';
      let buffer = '';
      
      // Add empty assistant message placeholder
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      setIsLoading(false); // Stop loading spinner as soon as stream starts

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // keep the incomplete trailing line in the buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
              const dataStr = trimmedLine.substring(6).trim();
              if (!dataStr || dataStr === '[DONE]') continue;
              try {
                const data = JSON.parse(dataStr);
                
                if (data.type === 'init') {
                  if (!currentConversationId && data.conversationId) {
                    setCurrentConversationId(data.conversationId);
                    fetchConversations(); // refresh the sidebar
                  }
                } else if (data.type === 'chunk' || data.type === 'error') {
                   assistantMessageContent += data.content;
                   setMessages((prev) => {
                     const newMessages = [...prev];
                     newMessages[newMessages.length - 1] = {
                       role: 'assistant',
                       content: assistantMessageContent
                     };
                     return newMessages;
                   });
                } else if (data.type === 'voice') {
                   // Server generated an audio voice file for the response
                   try {
                     const audio = new Audio(data.audio_url);
                     audio.play();
                   } catch (e) {
                     console.error("Failed to play voice response:", e);
                   }
                } else if (data.type === 'done') {
                   done = true;
                }
              } catch (e) {
                 console.error("Error parsing stream chunk", e, dataStr);
              }
            }
          }
        }
      }

    } catch (error) {
       console.error('Error generating response:', error);
       setMessages((prev) => [
        ...prev, 
        { role: 'assistant', content: 'Connection Error: Unable to reach the backend server (Is python backend running on port 5000?)' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const toggleVoiceAssistant = () => {
    if (isVoiceAssistantOn) {
      setIsVoiceAssistantOn(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } else {
      const SpeechRecognition = (window as Record<string, any>).SpeechRecognition || (window as Record<string, any>).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech Recognition API is not supported in this browser.");
        return;
      }
      
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-IN"; // Recognize Indian English + generic accents
      
      recognition.onstart = () => {
        setIsVoiceAssistantOn(true);
      };
      
      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        setInput(transcript);
      };
      
      recognition.onend = () => {
        setIsVoiceAssistantOn(false);
      };
      
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsVoiceAssistantOn(false);
      };
      
      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const toggleSpeech = (text: string, index: number) => {
    if (!synthRef.current) return;
    
    // Stop reading if clicked on the active message icon
    if (readingIndex === index) {
      synthRef.current.cancel();
      setReadingIndex(null);
      return;
    }
    
    synthRef.current.cancel();
    
    // Convert to readable text
    const cleanText = text.replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    utterance.onend = () => setReadingIndex(null);
    utterance.onerror = () => setReadingIndex(null);
    
    setReadingIndex(index);
    synthRef.current.speak(utterance);
  };


  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    setMessages([]);
    setCurrentConversationId(null);
    setConversations([]);
  };

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen w-full bg-background font-body text-foreground overflow-hidden">
      {/* Sidebar */}
      {isSidebarOpen && (
        <aside className="w-64 border-r border-border bg-sidebar-background flex flex-col h-full flex-shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-border">
          <div className="flex items-center gap-2 font-display font-semibold text-lg text-navy">
            <div className="w-8 h-8 rounded bg-navy text-gold flex items-center justify-center">
              <Scale size={18} />
            </div>
            Legal AI
          </div>
        </div>
        
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <button 
            onClick={startNewChat}
            className="flex items-center justify-center gap-2 border border-border rounded-md px-4 py-2 text-sm font-medium hover:bg-muted transition-colors w-full bg-card"
          >
            <Plus size={16} />
            New Chat
          </button>
          
          <div className="mt-6 flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-1 uppercase tracking-wider">Chat History</h3>
            
            {conversations.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground text-center px-4">
                  No conversations yet.<br />Start asking legal questions!
               </div>
            ) : (
               <div className="flex flex-col gap-1 pr-2">
                 {conversations.map(conv => (
                    <div 
                      key={conv.id} 
                      className="relative group flex items-center"
                      onContextMenu={(e) => handleContextMenu(e, conv.id)}
                    >
                      {renamingId === conv.id ? (
                         <div className={`flex items-center gap-2 w-full p-2 text-sm rounded-md border border-gold bg-card mr-1`}>
                           <MessageSquare size={14} className="shrink-0 text-muted-foreground" />
                           <input 
                             type="text" 
                             value={renameTitle}
                             onChange={(e) => setRenameTitle(e.target.value)}
                             onKeyDown={(e) => handleRenameKeyDown(e, conv.id)}
                             onBlur={() => handleRenameSubmit(conv.id)}
                             autoFocus
                             className="flex-1 bg-transparent border-none outline-none text-foreground"
                           />
                         </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => loadConversation(conv.id)}
                            className={`flex items-center gap-2 text-left w-full p-2 text-sm rounded-md transition-colors truncate
                              ${currentConversationId === conv.id ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                          >
                            <MessageSquare size={14} className="shrink-0" />
                            <span className="truncate flex-1">{conv.title || "Legal Query"}</span>
                          </button>
                          
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleContextMenu(e, conv.id);
                            }}
                            className="absolute right-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 text-muted-foreground transition-all"
                          >
                            <MoreVertical size={14} />
                          </button>
                        </>
                      )}
                    </div>
                 ))}
                 
                 <div className="mt-6 pt-4 border-t border-border">
                   <button 
                      onClick={handleDeleteAllConversations}
                      className="flex items-center justify-center gap-2 w-full p-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                   >
                     <Trash2 size={14} />
                     Clear All Chats
                   </button>
                 </div>
               </div>
            )}
          </div>
        </div>
      </aside>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div 
          className="fixed z-50 bg-card border border-border shadow-lg rounded-md py-1 min-w-[150px] overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => {
              const currentTitle = conversations.find(c => c.id === contextMenu.conversationId)?.title || '';
              startRenaming(contextMenu.conversationId, currentTitle);
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
          >
            <Edit2 size={14} /> Rename
          </button>
          <button 
            onClick={() => handleDeleteConversation(contextMenu.conversationId)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative bg-card">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-card">
          <div className="flex items-center gap-3 relative z-10">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <PanelLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-navy text-gold flex items-center justify-center">
                <Scale size={18} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm leading-tight text-navy">Legal Assistant AI</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Secured by Supabase & Firebase</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
             {/* Dynamic context placeholder */}
             {isVoiceAssistantOn && <span className="text-xs bg-gold/10 text-gold border border-gold/20 px-2 py-1 rounded hidden sm:inline-flex items-center gap-1"><Mic size={12} className="animate-pulse" /> Voice Active</span>}
             {currentConversationId && !isVoiceAssistantOn && <span className="text-xs bg-muted px-2 py-1 rounded hidden sm:inline-block">Active Database Session</span>}
            <div className="h-4 w-px bg-border mx-1"></div>
            <button 
              onClick={handleLogOut}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full relative">
            
            {messages.length === 0 ? (
            /* Welcome Screen */
            <div className="max-w-3xl mx-auto h-full flex flex-col items-center pt-16 pb-32 px-4">
              
              <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-border flex items-center justify-center mb-6 overflow-hidden">
                 <div className="w-full h-full bg-navy text-gold flex items-center justify-center">
                    <Scale size={40} />
                 </div>
              </div>
              
              <h1 className="text-4xl font-display font-medium text-navy mb-4 text-center">
                Legal Assistant AI
              </h1>
              
              <p className="text-center text-muted-foreground max-w-lg mb-8 text-sm">
                Get clear, structured legal guidance on procedures, rights,
                and laws. Ask anything about your legal concerns.
              </p>

              {/* Tags */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-card text-muted-foreground hover:bg-muted cursor-default transition">
                  <Scale size={14} className="text-gold" />
                  IPC Sections
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-card text-muted-foreground hover:bg-muted cursor-default transition">
                  <FileText size={14} className="text-gold" />
                  FIR Guidance
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-card text-muted-foreground hover:bg-muted cursor-default transition">
                  <Shield size={14} className="text-gold" />
                  Know Your Rights
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-card text-muted-foreground hover:bg-muted cursor-default transition">
                  <Gavel size={14} className="text-gold" />
                  Court Procedures
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-card text-muted-foreground hover:bg-muted cursor-default transition">
                  <BookOpen size={14} className="text-gold" />
                  தமிழ் / हिन्दी
                </span>
              </div>

              {/* Suggestion Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {[
                  "How do I file an FIR?",
                  "Explain IPC Section 420",
                  "What is the bail procedure?",
                  "How to get free legal aid?",
                  "எனது அடிப்படை உரிமைகள் என்ன?",
                  "उपभोक्ता शिकायत कैसे दर्ज करें?"
                ].map((text, i) => (
                  <button 
                    key={i}
                    onClick={() => handleSuggestionClick(text)}
                    className="p-4 border border-border rounded-xl text-left text-sm text-foreground hover:bg-muted transition-colors bg-card shadow-sm cursor-pointer"
                  >
                    {text}
                  </button>
                ))}
              </div>

            </div>
          ) : (
            /* Chat Messages Timeline */
             <div className="max-w-3xl mx-auto flex flex-col pt-8 pb-32 px-4 gap-6">
                {messages.map((message, i) => (
                   <div key={i} className={`flex mb-4 w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 shrink-0 rounded bg-navy text-gold flex items-center justify-center mr-4 mt-1">
                          <Scale size={16} />
                        </div>
                      )}
                      
                      <div className={`flex flex-col max-w-[85%] ${message.role === 'user' ? 'items-end' : 'items-start min-w-[250px]'}`}>
                        <div 
                          className={`w-full rounded-2xl p-4 ${
                            message.role === 'user' 
                            ? 'bg-chat-user text-chat-user-foreground rounded-tr-sm' 
                            : 'bg-chat-ai text-chat-ai-foreground border border-border rounded-tl-sm'
                          }`}
                        >
                           <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                                  strong: ({node, ...props}) => <strong className="font-semibold text-current" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-3 space-y-1" {...props} />,
                                  ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-3 space-y-1" {...props} />,
                                  li: ({node, ...props}) => <li className="" {...props} />,
                                  h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-3 mt-4" {...props} />,
                                  h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-3 mt-4" {...props} />,
                                  h3: ({node, ...props}) => <h3 className="text-md font-bold mb-2 mt-3" {...props} />,
                                  code: ({node, inline, className, children, ...props}: any) => {
                                    return !inline ? (
                                      <div className="bg-[#1e1e2d] text-gray-200 rounded-lg p-3 my-3 overflow-x-auto text-xs font-mono shadow-inner border border-white/5">
                                        <code {...props} className={className}>{children}</code>
                                      </div>
                                    ) : (
                                      <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-current font-mono text-[0.85em]" {...props}>
                                        {children}
                                      </code>
                                    )
                                  },
                                  a: ({node, ...props}) => <a className="text-gold hover:underline font-medium break-all" target="_blank" rel="noopener noreferrer" {...props} />,
                                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gold bg-gold/5 pl-4 py-2 pr-2 italic my-3 text-current rounded-r-lg opacity-90" {...props} />,
                                  table: ({node, ...props}) => <div className="overflow-x-auto my-4 w-full"><table className="min-w-full divide-y divide-border border border-border rounded-lg overflow-hidden text-left" {...props} /></div>,
                                  thead: ({node, ...props}) => <thead className="bg-black/5" {...props} />,
                                  th: ({node, ...props}) => <th className="px-4 py-3 text-xs font-semibold text-current uppercase tracking-wider border-b border-border" {...props} />,
                                  td: ({node, ...props}) => <td className="px-4 py-3 text-sm border-b border-border/50" {...props} />,
                                  hr: ({node, ...props}) => <hr className="my-4 border-border" {...props} />,
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                           </div>
                        </div>
                        
                        {message.role === 'assistant' && !isLoading && (
                          <div className="mt-2 flex items-center justify-between w-full">
                            <button
                              onClick={() => toggleSpeech(message.content, i)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                              title={readingIndex === i ? "Stop Listening" : "Listen to answer"}
                            >
                              <Headphones size={14} className={readingIndex === i ? 'text-gold fill-gold/20' : ''} />
                              <span className={readingIndex === i ? 'text-gold' : ''}>{readingIndex === i ? "Listening..." : "Listen"}</span>
                            </button>
                            
                            <button
                              onClick={() => handleCopy(message.content, i)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                              title="Copy to clipboard"
                            >
                              {copiedIndex === i ? (
                                <>
                                  <Check size={14} className="text-green-500" />
                                  <span className="text-green-500">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={14} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                   </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="w-8 h-8 shrink-0 rounded bg-navy text-gold flex items-center justify-center mr-4 mt-1">
                      <Scale size={16} />
                    </div>
                    <div className="bg-chat-ai text-chat-ai-foreground border border-border rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Consulting legal sources...</span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
             </div>
          )}

        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-card via-card to-transparent pt-6 pb-4 z-20">
          <div className="max-w-3xl mx-auto px-4">
            
            {/* File Attachment Pill */}
            {selectedFile && (
              <div className="mb-2 flex items-center">
                <div className="bg-muted border border-border px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-sm">
                  <FileText size={14} className="text-muted-foreground cursor-default" />
                  <span className="truncate max-w-[200px] text-foreground font-medium cursor-default">{selectedFile.name}</span>
                  <button onClick={() => setSelectedFile(null)} className="text-muted-foreground hover:text-destructive transition-colors ml-1 w-5 h-5 flex items-center justify-center rounded-full hover:bg-destructive/10">
                    &times;
                  </button>
                </div>
              </div>
            )}

            <div className={`relative flex items-center bg-muted/60 border border-border rounded-xl p-2 pr-2.5 pb-2 shadow-sm transition-all
              ${!isVoiceAssistantOn ? 'focus-within:ring-1 focus-within:ring-gold focus-within:border-gold' : ''}
              ${isVoiceAssistantOn ? 'opacity-80' : ''}`}
            >
              <button 
                onClick={toggleVoiceAssistant}
                title={isVoiceAssistantOn ? "Turn off Voice Assistant" : "Turn on Voice Assistant"}
                className={`p-2 rounded-full transition-colors flex items-center justify-center shrink-0
                  ${isVoiceAssistantOn 
                    ? 'bg-gold/20 text-gold shadow-inner ring-2 ring-gold/50' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <Mic size={20} className={isVoiceAssistantOn ? 'animate-pulse' : ''} />
              </button>
              
              <input 
                type="text" 
                value={isVoiceAssistantOn && !input ? "Listening..." : input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || isVoiceAssistantOn}
                placeholder={"अपना कानूनी सवाल पूछें / Describe your legal question..."}
                className={`flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm px-2 disabled:opacity-80
                   ${isVoiceAssistantOn && !input ? 'text-gold font-medium animate-pulse' : 'text-foreground placeholder:text-muted-foreground'}`}
              />
              
              <div className="flex items-center gap-1 ml-2">
                <button 
                  disabled={isVoiceAssistantOn}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 text-muted-foreground hover:text-foreground rounded-full transition-colors disabled:opacity-50"
                  title="Attach document (PDF/TXT)"
                >
                  <Paperclip size={18} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  className="hidden" 
                  accept=".pdf,.txt,.md,.csv" 
                />
                <button 
                  onClick={handleSend}
                  disabled={(!input.trim() && !selectedFile) || isLoading || isVoiceAssistantOn}
                  className="p-2.5 bg-gold hover:bg-gold-light text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={18} className="ml-0.5" />
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-3">
              This AI provides legal guidance only and does not replace professional legal advice.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
