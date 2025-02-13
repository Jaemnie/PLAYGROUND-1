type QueueTask = {
  type: 'market-update' | 'news-update' | 'market-open' | 'market-close';
  priority: number;
  timestamp: number;
  execute: () => Promise<void>;
}

export class MarketQueue {
  private static instance: MarketQueue | null = null;
  private queue: QueueTask[] = [];
  private isProcessing: boolean = false;

  private constructor() {}

  static getInstance(): MarketQueue {
    if (!MarketQueue.instance) {
      MarketQueue.instance = new MarketQueue();
    }
    return MarketQueue.instance;
  }

  private sortQueue() {
    // 우선순위가 높은 순, 같은 우선순위면 먼저 들어온 순
    this.queue.sort((a, b) => 
      b.priority - a.priority || a.timestamp - b.timestamp
    );
  }

  async addTask(task: Omit<QueueTask, 'timestamp'>) {
    this.queue.push({
      ...task,
      timestamp: Date.now()
    });
    this.sortQueue();
    
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const task = this.queue[0];
        await task.execute();
        this.queue.shift(); // 완료된 태스크 제거
      }
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }
} 