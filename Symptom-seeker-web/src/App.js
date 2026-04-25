import React, { useState, useEffect, useRef } from 'react';
import { 
  AppShell, 
  Text, 
  Stack, 
  Button, 
  TextInput, 
  Title, 
  Card, 
  Center, 
  Paper, 
  ScrollArea, 
  Flex,
  Group,
  PasswordInput,
  Container,
  ActionIcon,
  Loader,
  Switch,
  Pill,
  Badge,
  Tooltip,
  SimpleGrid
} from '@mantine/core';
import { IconSend, IconMessageChatbot, IconUser, IconPlus, IconSparkles } from '@tabler/icons-react';
import { api } from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('user_id') || '');
  
  // Auth state
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  
  // App state
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIsolatedMode, setIsIsolatedMode] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  
  const viewport = useRef(null);

  // Fetch initial data
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (viewport.current) {
      viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
    }
  }, [activeMessages]);

  const loadConversations = async () => {
    try {
      const data = await api.getConversations();
      // data.conversations is array of {id, title}
      setConversations(data.conversations || []);
      if (data.active_conversation_id) {
        setActiveConvId(data.active_conversation_id);
        loadMessages(data.active_conversation_id);
      }
    } catch (err) {
      console.error(err);
      if (err.message.includes('401') || err.message.includes('fetch')) handleLogout();
    }
  };

  const loadMessages = async (convId) => {
    try {
      const conv = await api.getConversation(convId);
      setActiveMessages(conv.messages || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAuth = async () => {
    try {
      if (authMode === 'signup') {
        await api.signup(loginId, loginPassword);
        // Automatically login after signup
      }
      const data = await api.login(loginId, loginPassword);
      setUsername(loginId);
      setIsAuthenticated(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    setConversations([]);
    setActiveConvId(null);
    setActiveMessages([]);
  };

  const handleSummarize = async (e, convId) => {
    e.stopPropagation();
    try {
      setIsLoading(true);
      await api.summarizeConversation(convId);
      await loadConversations();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectConversation = async (id) => {
    try {
      await api.setActiveConversation(id);
      setActiveConvId(id);
      loadMessages(id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async (overrideMsg) => {
    const textToSend = typeof overrideMsg === 'string' ? overrideMsg : inputMessage;
    if (!textToSend.trim()) return;
    const msg = textToSend;
    setInputMessage('');
    setIsLoading(true);

    // Optimistic UI
    setActiveMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date().toISOString() }]);

    try {
      const activeConv = conversations.find(c => c.id === activeConvId);
      const isConvIsolated = activeConv ? activeConv.isolated : isIsolatedMode;

      let res;
      if (isConvIsolated) {
        res = await api.triageIgnoreHistory(msg);
      } else {
        res = await api.triage(msg);
      }
      
      // If it created a new conversation, we need to refresh the list and set it active
      if (res.conversation_id && res.conversation_id !== activeConvId) {
        setActiveConvId(res.conversation_id);
        await loadConversations(); 
      } else {
        // Reload messages to get the AI response
        await loadMessages(activeConvId);
      }

      // Automatically generate a summary in the background after the recommendation is given
      api.summarizeConversation(res.conversation_id).then(() => {
        loadConversations();
      }).catch(err => console.error("Auto-summarize failed:", err));
      
    } catch (err) {
      console.error(err);
      alert("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Center style={{ width: '100vw', height: '100vh', backgroundColor: '#1A1B1E' }}>
        <Paper radius="md" p="xl" withBorder style={{ width: 400 }}>
          <Title order={2} ta="center" mb="md">Symptom Seeker</Title>
          <Stack>
            <TextInput 
              label="User ID" 
              value={loginId} 
              onChange={(e) => setLoginId(e.currentTarget.value)} 
            />
            <PasswordInput 
              label="Password" 
              value={loginPassword} 
              onChange={(e) => setLoginPassword(e.currentTarget.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            />
            <Button fullWidth mt="md" onClick={handleAuth}>
              {authMode === 'login' ? 'Login' : 'Sign Up'}
            </Button>
            <Text c="dimmed" size="sm" ta="center" mt="md">
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <Text span c="blue" style={{ cursor: 'pointer' }} onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
                {authMode === 'login' ? 'Sign Up' : 'Login'}
              </Text>
            </Text>
          </Stack>
        </Paper>
      </Center>
    );
  }

  // Reverse conversations so most recent is first, and take top 3
  const recentConversations = [...conversations].reverse().slice(0, 3);

  return (
    <AppShell
      navbar={{ width: '25vw', breakpoint: 'sm' }} // 1/4th of screen is 25vw
      padding="md"
    >
      <AppShell.Navbar p="md" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Group justify="space-between" mb="xl">
          <Text fw={700} size="lg" truncate>{username}</Text>
          <Button variant="subtle" size="xs" color="red" onClick={handleLogout}>Exit</Button>
        </Group>
        <Button 
          variant="filled" 
          color="blue" 
          fullWidth 
          mb="xs" 
          leftSection={<IconPlus size={16} />}
          loading={isLoading}
          onClick={async () => {
            try {
              setIsLoading(true);
              await api.createConversation("New Conversation", isIsolatedMode);
              await loadConversations();
              setShowAllHistory(false);
            } catch (err) {
              console.error(err);
              alert("Failed to create conversation");
            } finally {
              setIsLoading(false);
            }
          }}
        >
          New Conversation
        </Button>
        <Switch
          label="Isolated Chat"
          size="xs"
          mb="xl"
          checked={isIsolatedMode}
          onChange={(event) => setIsIsolatedMode(event.currentTarget.checked)}
        />

        <Text c="dimmed" size="xs" fw={700} mb="sm" tt="uppercase">Recent Conversations</Text>
        <Stack flex={1} gap="sm" style={{ overflowY: 'auto' }}>
          {recentConversations.map(conv => (
            <Card 
              key={conv.id} 
              shadow="sm" 
              p="sm" 
              radius="md" 
              withBorder 
              style={{ cursor: 'pointer', backgroundColor: activeConvId === conv.id ? 'var(--mantine-color-blue-light)' : undefined }}
              onClick={() => {
                selectConversation(conv.id);
                setShowAllHistory(false);
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Text fw={700} size="sm" lineClamp={1} style={{ flex: 1 }}>
                  {conv.title}
                  {conv.isolated && <Badge size="xs" variant="outline" color="orange" ml="xs">I</Badge>}
                </Text>
                <Tooltip label="Summarize Chat">
                  <ActionIcon size="sm" variant="light" onClick={(e) => handleSummarize(e, conv.id)}>
                    <IconSparkles size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>

              {conv.symptoms && conv.symptoms.length > 0 && (
                <Group gap={4} mt="xs">
                  {conv.symptoms.map(s => <Pill key={s} size="xs" bg="blue.9" c="white">{s}</Pill>)}
                </Group>
              )}
              {conv.recommended_action && conv.recommended_action !== "No recommended action." && (
                <Group gap={4} mt={4}>
                  <Pill size="xs" bg="green.9" c="white">{conv.recommended_action}</Pill>
                </Group>
              )}
              {(!conv.symptoms || conv.symptoms.length === 0) && (!conv.recommended_action || conv.recommended_action === "No recommended action.") && (
                <Text size="xs" c="dimmed" mt={4}>
                  Latest Activity
                </Text>
              )}
            </Card>
          ))}
        </Stack>

        <Button 
          variant={showAllHistory ? "filled" : "light"} 
          fullWidth 
          mt="auto"
          onClick={() => setShowAllHistory(!showAllHistory)}
        >
          {showAllHistory ? "Back to chat" : "View all history"}
        </Button>
      </AppShell.Navbar>

      <AppShell.Main style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {showAllHistory ? (
          <ScrollArea style={{ flex: 1, padding: 16 }}>
            <Title order={2} mb="xl" ml="md">Conversation History</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md" px="md">
              {conversations.map(conv => (
                <Card 
                  key={conv.id} 
                  shadow="sm" 
                  p="sm" 
                  radius="md" 
                  withBorder 
                  style={{ cursor: 'pointer', backgroundColor: activeConvId === conv.id ? 'var(--mantine-color-blue-light)' : undefined }}
                  onClick={() => {
                    selectConversation(conv.id);
                    setShowAllHistory(false);
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Text fw={700} size="sm" lineClamp={1} style={{ flex: 1 }}>
                      {conv.title}
                      {conv.isolated && <Badge size="xs" variant="outline" color="orange" ml="xs">I</Badge>}
                    </Text>
                    <Tooltip label="Summarize Chat">
                      <ActionIcon size="sm" variant="light" onClick={(e) => handleSummarize(e, conv.id)}>
                        <IconSparkles size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>

                  {conv.symptoms && conv.symptoms.length > 0 && (
                    <Group gap={4} mt="xs">
                      {conv.symptoms.map(s => <Pill key={s} size="xs" bg="blue.9" c="white">{s}</Pill>)}
                    </Group>
                  )}
                  {conv.recommended_action && conv.recommended_action !== "No recommended action." && (
                    <Group gap={4} mt={4}>
                      <Pill size="xs" bg="green.9" c="white">{conv.recommended_action}</Pill>
                    </Group>
                  )}
                  {(!conv.symptoms || conv.symptoms.length === 0) && (!conv.recommended_action || conv.recommended_action === "No recommended action.") && (
                    <Text size="xs" c="dimmed" mt={4}>
                      Latest Activity
                    </Text>
                  )}
                </Card>
              ))}
            </SimpleGrid>
          </ScrollArea>
        ) : activeMessages.length === 0 ? (
          <Center style={{ flex: 1, flexDirection: 'column' }}>
            <Title order={2} mb="xl">What's going on today?</Title>
            <Container size="sm" w="100%">
              <Group gap="sm" mb="md" justify="center">
                {["Headache and fever", "Sore throat and cough", "Stomach pain", "Shortness of breath"].map((symptom) => (
                  <Button 
                    key={symptom} 
                    variant="light" 
                    radius="xl" 
                    size="xs" 
                    onClick={() => handleSend(symptom)}
                    disabled={isLoading}
                  >
                    {symptom}
                  </Button>
                ))}
              </Group>
              <TextInput
                size="xl"
                radius="xl"
                placeholder="Describe your symptoms..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                rightSection={
                  <ActionIcon size={32} radius="xl" color="blue" variant="filled" onClick={handleSend} loading={isLoading}>
                    <IconSend size={18} stroke={1.5} />
                  </ActionIcon>
                }
              />
            </Container>
          </Center>
        ) : (
          <>
            <ScrollArea viewportRef={viewport} style={{ flex: 1, paddingRight: 16 }} pb="xl">
              <Stack gap="lg" maw={800} mx="auto" pt="xl">
                {activeMessages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  return (
                    <Flex key={idx} justify={isUser ? 'flex-end' : 'flex-start'}>
                      {!isUser && (
                        <ActionIcon size="lg" radius="xl" variant="light" color="blue" mr="sm">
                          <IconMessageChatbot />
                        </ActionIcon>
                      )}
                      <Paper 
                        p="md" 
                        radius="lg" 
                        withBorder={!isUser}
                        bg={isUser ? 'blue' : 'dark.6'}
                        c={isUser ? 'white' : undefined}
                        style={{ maxWidth: '75%', borderBottomRightRadius: isUser ? 0 : undefined, borderBottomLeftRadius: !isUser ? 0 : undefined }}
                      >
                        <Text size="sm">{msg.content}</Text>
                        <Text size="xs" mt={4} ta={isUser ? 'right' : 'left'} opacity={0.5}>
                          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </Text>
                      </Paper>
                      {isUser && (
                        <ActionIcon size="lg" radius="xl" variant="filled" color="gray" ml="sm">
                          <IconUser />
                        </ActionIcon>
                      )}
                    </Flex>
                  );
                })}
                {isLoading && (
                  <Flex justify="flex-start">
                     <ActionIcon size="lg" radius="xl" variant="light" color="blue" mr="sm">
                        <IconMessageChatbot />
                      </ActionIcon>
                     <Paper p="md" radius="lg" bg="dark.6" withBorder style={{ borderBottomLeftRadius: 0 }}>
                       <Loader size="sm" type="dots" />
                     </Paper>
                  </Flex>
                )}
              </Stack>
            </ScrollArea>

            <Container size="md" w="100%" pb="md">
              <TextInput
                size="md"
                radius="xl"
                placeholder="Type your message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isLoading}
                rightSection={
                  <ActionIcon size={32} radius="xl" color="blue" variant="filled" onClick={handleSend} loading={isLoading}>
                    <IconSend size={18} stroke={1.5} />
                  </ActionIcon>
                }
              />
            </Container>
          </>
        )}
      </AppShell.Main>
    </AppShell>
  );
}

export default App;