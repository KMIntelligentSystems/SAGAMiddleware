import { EventEmitter } from 'events';
import {
  HumanApprovalStage,
  HumanApprovalToken,
  HumanDecision,
  ApprovalArtifacts,
  TimeoutStrategy,
  HumanInLoopConfig
} from '../types/humanInLoopSaga.js';

export class HumanInteractionService extends EventEmitter {
  private pendingApprovals: Map<string, HumanApprovalToken> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private config: HumanInLoopConfig;

  constructor(config: HumanInLoopConfig) {
    super();
    this.config = config;
  }

  /**
   * Request human approval for a specific SAGA stage
   */
  async requestApproval(
    transactionId: string,
    stage: HumanApprovalStage['stage'],
    artifacts: ApprovalArtifacts
  ): Promise<HumanApprovalToken> {
    const interactionToken = this.generateInteractionToken(transactionId, stage);
    
    // Determine timeout based on stage
    const timeoutMs = this.getTimeoutForStage(stage);
    const expiresAt = new Date(Date.now() + timeoutMs);

    const approvalToken: HumanApprovalToken = {
      token: interactionToken,
      transactionId,
      stage,
      expiresAt,
      artifacts,
      approvalUrl: this.generateApprovalUrl(interactionToken)
    };

    // Store pending approval
    this.pendingApprovals.set(interactionToken, approvalToken);

    // Schedule timeout
    await this.scheduleTimeout(transactionId, interactionToken, timeoutMs);

    // Emit event for external systems (email, Slack, etc.)
    this.emit('approval_requested', {
      transactionId,
      stage,
      interactionToken,
      artifacts,
      approvalUrl: approvalToken.approvalUrl,
      expiresAt
    });

    console.log(`🤝 Human approval requested for ${stage} (Transaction: ${transactionId})`);
    console.log(`📧 Approval URL: ${approvalToken.approvalUrl}`);
    console.log(`⏰ Expires at: ${expiresAt.toISOString()}`);

    return approvalToken;
  }

  /**
   * Process human decision received via API or event bus
   */
  async receiveDecision(
    interactionToken: string,
    decision: Omit<HumanDecision, 'transactionId' | 'interactionToken' | 'decidedAt'>
  ): Promise<HumanDecision> {
    const approval = this.pendingApprovals.get(interactionToken);
    if (!approval) {
      throw new Error(`No pending approval found for token: ${interactionToken}`);
    }

    // Check if expired
    if (new Date() > approval.expiresAt) {
      throw new Error(`Approval token expired: ${interactionToken}`);
    }

    const humanDecision: HumanDecision = {
      transactionId: approval.transactionId,
      interactionToken,
      decision: decision.decision,
      feedback: decision.feedback,
      modifications: decision.modifications,
      decidedAt: new Date(),
      decidedBy: decision.decidedBy
    };

    // Clean up
    this.pendingApprovals.delete(interactionToken);
    this.cancelTimeout(interactionToken);

    // Emit decision event
    this.emit('decision_received', humanDecision);

    console.log(`✅ Human decision received: ${decision.decision} for ${approval.stage}`);
    console.log(`💬 Feedback: ${decision.feedback || 'None'}`);

    return humanDecision;
  }

  /**
   * Get current pending approvals for a transaction
   */
  getPendingApprovals(transactionId: string): HumanApprovalToken[] {
    return Array.from(this.pendingApprovals.values())
      .filter(approval => approval.transactionId === transactionId);
  }

  /**
   * Cancel all pending approvals for a transaction
   */
  async cancelApprovals(transactionId: string, reason: string = 'Transaction cancelled'): Promise<void> {
    const pendingTokens = Array.from(this.pendingApprovals.entries())
      .filter(([_, approval]) => approval.transactionId === transactionId)
      .map(([token, _]) => token);

    for (const token of pendingTokens) {
      this.pendingApprovals.delete(token);
      this.cancelTimeout(token);
    }

    this.emit('approvals_cancelled', { transactionId, reason, cancelledTokens: pendingTokens });
    console.log(`❌ Cancelled ${pendingTokens.length} pending approvals for transaction ${transactionId}`);
  }

  /**
   * Persist interaction state for long-running transactions
   */
  async persistInteractionState(transactionId: string, state: any): Promise<void> {
    // In a real implementation, this would save to database/Redis
    // For now, emit event for external persistence service
    this.emit('state_persist_requested', {
      transactionId,
      state,
      timestamp: new Date()
    });

    console.log(`💾 Persisting interaction state for transaction ${transactionId}`);
  }

  /**
   * Resume interaction state from persistence
   */
  async resumeInteractionState(transactionId: string): Promise<any> {
    // In a real implementation, this would load from database/Redis
    // For now, emit event and return null (would be handled by persistence service)
    this.emit('state_resume_requested', { transactionId });
    
    console.log(`🔄 Resuming interaction state for transaction ${transactionId}`);
    return null; // Would return actual state in real implementation
  }

  /**
   * Schedule timeout for human interaction
   */
  private async scheduleTimeout(
    transactionId: string,
    interactionToken: string,
    timeoutMs: number
  ): Promise<void> {
    const timeout = setTimeout(() => {
      this.handleTimeout(transactionId, interactionToken);
    }, timeoutMs);

    this.timeouts.set(interactionToken, timeout);
  }

  /**
   * Cancel scheduled timeout
   */
  private cancelTimeout(interactionToken: string): void {
    const timeout = this.timeouts.get(interactionToken);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(interactionToken);
    }
  }

  /**
   * Handle timeout for human interaction
   */
  private handleTimeout(transactionId: string, interactionToken: string): void {
    const approval = this.pendingApprovals.get(interactionToken);
    if (!approval) return;

    // Clean up
    this.pendingApprovals.delete(interactionToken);
    this.timeouts.delete(interactionToken);

    // Emit timeout event
    this.emit('approval_timeout', {
      transactionId,
      interactionToken,
      stage: approval.stage,
      timeoutStrategy: this.config.timeouts.onTimeout
    });

    console.log(`⏰ Human approval timeout for ${approval.stage} (Transaction: ${transactionId})`);
  }

  /**
   * Generate unique interaction token
   */
  private generateInteractionToken(transactionId: string, stage: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `approval_${stage}_${transactionId}_${timestamp}_${random}`;
  }

  /**
   * Get timeout duration for approval stage
   */
  private getTimeoutForStage(stage: HumanApprovalStage['stage']): number {
    switch (stage) {
      case 'specification_review':
        return this.config.timeouts.specificationReviewTimeout;
      case 'code_review':
        return this.config.timeouts.codeReviewTimeout;
      case 'final_approval':
        return this.config.timeouts.finalApprovalTimeout;
      default:
        return this.config.timeouts.specificationReviewTimeout;
    }
  }

  /**
   * Generate approval URL for human review
   */
  private generateApprovalUrl(interactionToken: string): string {
    const baseUrl = this.config.humanInterface.approvalBaseUrl;
    return `${baseUrl}/approve/${interactionToken}`;
  }

  /**
   * Get service statistics
   */
  getStats(): {
    pendingApprovals: number;
    activeTimeouts: number;
    totalRequested: number;
    totalCompleted: number;
  } {
    // In a real implementation, these would be tracked metrics
    return {
      pendingApprovals: this.pendingApprovals.size,
      activeTimeouts: this.timeouts.size,
      totalRequested: 0, // Would track this
      totalCompleted: 0  // Would track this
    };
  }

  /**
   * Cleanup expired approvals and timeouts
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    const expiredTokens: string[] = [];

    for (const [token, approval] of this.pendingApprovals.entries()) {
      if (now > approval.expiresAt) {
        expiredTokens.push(token);
      }
    }

    for (const token of expiredTokens) {
      const approval = this.pendingApprovals.get(token);
      if (approval) {
        this.handleTimeout(approval.transactionId, token);
      }
    }

    console.log(`🧹 Cleaned up ${expiredTokens.length} expired approvals`);
  }

  /**
   * Shutdown service and cleanup resources
   */
  async shutdown(): Promise<void> {
    // Cancel all pending timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }

    // Clear all pending approvals
    this.pendingApprovals.clear();
    this.timeouts.clear();

    this.emit('service_shutdown');
    console.log('🔄 Human Interaction Service shutdown complete');
  }
}