import axios from 'axios';

import { logger } from '../lib/logger';

export interface JokeApiResponse {
  id: number;
  type: string;
  setup: string;
  punchline: string;
}

const JOKE_API_URL = 'https://official-joke-api.appspot.com/random_joke';

export async function fetchRandomJoke(): Promise<JokeApiResponse> {
  logger.debug('Requesting random joke from API', { url: JOKE_API_URL });

  try {
    const { data } = await axios.get<JokeApiResponse>(JOKE_API_URL, {
      timeout: 5000,
    });

    if (!data || !data.setup || !data.punchline) {
      const error = new Error('Received malformed joke data');
      logger.error(error, 'Joke API returned invalid payload');
      throw error;
    }

    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const message = error.message;
      const formattedError = new Error(
        `Failed to fetch joke${status ? ` (status ${status}${statusText ? ` ${statusText}` : ''})` : ''}: ${message}`,
      );
      logger.error(formattedError, 'Axios error while fetching joke');
      throw formattedError;
    }

    logger.error(error, 'Unexpected error while fetching joke');
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to fetch joke: ${message}`);
  }
}
