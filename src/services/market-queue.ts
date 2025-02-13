type QueueTask = {
  type: 'market-update' | 'news-update' | 'market-open' | 'market-close';
  priority: number;
  timestamp: number;
  dependencies?: string[];
  execute: () => Promise<void>;
}

export class MarketQueue {
  private static instance: MarketQueue | null = null;
  private queue: QueueTask[] = [];
  private isProcessing: boolean = false;
  private processingPromise: Promise<void> | null = null;
  private completedTasks: Set<string> = new Set();  // 완료된 태스크 추적

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
    const timestamp = Date.now();
    
    // 30분마다 들어오는 뉴스 업데이트와 마켓 업데이트가 동시에 들어온 경우
    if (task.type === 'market-update') {
      const recentNews = this.queue.find(t => 
        t.type === 'news-update' && 
        timestamp - t.timestamp < 1000  // 1초 이내에 들어온 뉴스가 있는지 확인
      );
      
      if (recentNews) {
        task.dependencies = ['news-update'];  // 뉴스 업데이트에 대한 의존성 추가
      }
    }

    this.queue.push({
      ...task,
      timestamp
    });
    
    this.sortQueue();
    
    if (this.processingPromise) {
      await this.processingPromise;
    }
    
    if (!this.isProcessing) {
      this.processingPromise = this.processQueue();
      await this.processingPromise;
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        this.sortQueue();
        const task = this.queue[0];
        
        // 의존성 체크
        if (task.dependencies?.length) {
          const hasPendingDependencies = task.dependencies.some(depType => 
            !this.completedTasks.has(depType)
          );
          
          if (hasPendingDependencies) {
            // 의존성이 해결되지 않은 경우, 큐의 뒤로 이동
            this.queue.shift();
            this.queue.push(task);
            continue;
          }
        }

        await task.execute();
        this.completedTasks.add(task.type);  // 완료된 태스크 기록
        this.queue.shift();
        
        // 30초 후 완료 기록 제거 (다음 주기를 위해)
        setTimeout(() => {
          this.completedTasks.delete(task.type);
        }, 30000);
      }
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.isProcessing = false;
      this.processingPromise = null;
    }
  }
} 