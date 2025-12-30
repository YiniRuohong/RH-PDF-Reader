import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

export type AppConfig = {
  models: {
    planner: string
    executor: string
  }
  runtime: {
    workspaceDir: string
    maxConcurrency: number
  }
  mineru: {
    cliPath: string
    args: string[]
    model: {
      name: string
      path: string
    }
  }
  openai: {
    apiBase: string
    subscriptionUrl: string
    apiKeyEnv: string
  }
  export: {
    defaultFormats: string[]
  }
}

const defaultConfig: AppConfig = {
  models: {
    planner: 'gpt-4.1-mini',
    executor: 'gpt-4.1-mini'
  },
  runtime: {
    workspaceDir: './workspace',
    maxConcurrency: 2
  },
  mineru: {
    cliPath: 'mineru',
    args: [],
    model: {
      name: 'mineru-default',
      path: ''
    }
  },
  openai: {
    apiBase: 'https://api.openai.com/v1',
    subscriptionUrl: '',
    apiKeyEnv: 'OPENAI_API_KEY'
  },
  export: {
    defaultFormats: ['md', 'json', 'html']
  }
}

const getUserConfigPath = () => {
  const userDir = app.getPath('userData')
  return join(userDir, 'config.json')
}

export const ensureUserConfig = async () => {
  const configPath = getUserConfigPath()
  try {
    await fs.access(configPath)
  } catch {
    const payload = JSON.stringify(defaultConfig, null, 2)
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await fs.writeFile(configPath, payload, 'utf-8')
  }
  return configPath
}
