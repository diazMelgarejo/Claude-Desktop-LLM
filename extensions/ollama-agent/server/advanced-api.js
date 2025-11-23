// Advanced API functions for Ollama and LM Studio

// Embeddings - Ollama
export async function ollamaGenerateEmbeddings(text, model, baseUrl, timeout) {
    const response = await fetch(`${baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            prompt: text,
        }),
        signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
}

// Embeddings - LM Studio (OpenAI compatible)
export async function lmstudioGenerateEmbeddings(text, model, baseUrl, timeout) {
    const response = await fetch(`${baseUrl}/v1/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            input: text,
        }),
        signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
}

// Generate with custom parameters - Ollama
export async function ollamaGenerateWithParams(prompt, model, parameters, baseUrl, timeout) {
    const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            prompt: prompt,
            stream: false,
            options: parameters,
        }),
        signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
}

// Generate with custom parameters - LM Studio
export async function lmstudioGenerateWithParams(prompt, model, parameters, baseUrl, timeout) {
    const response = await fetch(`${baseUrl}/v1/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            prompt: prompt,
            ...parameters,
        }),
        signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.text || '';
}

// Chat with custom parameters - Ollama
export async function ollamaChatWithParams(messages, model, parameters, baseUrl, timeout) {
    const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: messages,
            stream: false,
            options: parameters,
        }),
        signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
}

// Chat with custom parameters - LM Studio
export async function lmstudioChatWithParams(messages, model, parameters, baseUrl, timeout) {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: messages,
            ...parameters,
        }),
        signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message.content || '';
}
