import axios from 'axios';

export interface JokeApiResponse {
  id: number;
  type: string;
  setup: string;
  punchline: string;
}

const JOKE_API_URL = 'https://official-joke-api.appspot.com/random_joke';

export async function fetchRandomJoke(): Promise<JokeApiResponse> {
  try {
    const { data } = await axios.get<JokeApiResponse>(JOKE_API_URL, {
      timeout: 5000,
    });

    if (!data || !data.setup || !data.punchline) {
      throw new Error('Received malformed joke data');
    }

    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const message = error.message;
      throw new Error(
        `Failed to fetch joke${status ? ` (status ${status}${statusText ? ` ${statusText}` : ''})` : ''}: ${message}`,
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to fetch joke: ${message}`);
  }
}
