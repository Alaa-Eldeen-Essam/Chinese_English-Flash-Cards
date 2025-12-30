# Upgrades & AI Integrations

## AI and ML extensions

- Example sentence generation using small local models (Llama.cpp, Ollama) or hosted APIs.
- Pronunciation checking by comparing user audio to phoneme targets.
- Tone feedback by extracting pitch contours from recordings.
- Semantic clustering to auto-group vocab by topic or HSK level.

## Offline-first enhancements

- Add IndexedDB persistence in the frontend for cards and review logs.
- Cache audio assets and example sentences for offline review.
- Implement a background sync queue with exponential backoff.

## Provider notes

- Hugging Face Inference API: https://huggingface.co/docs/api-inference
- Replicate pricing: https://replicate.com/pricing
- Cohere pricing: https://cohere.com/pricing

## Model hosting tips

- For local inference, keep models under 4-8GB to fit typical laptops.
- Consider distilled or quantized models for faster response.
- Use batch generation for import jobs to reduce per-request overhead.
