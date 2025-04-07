export interface ReviewCategory {
    name: string;
    description: string;
}

export interface ModelInfo {
    id: string;
    name: string;
    description?: string;
}

export interface ModelMetrics {
    model: ModelInfo;
    status: string;
    latencyMs: number | string;
    cost: number;
    totalTokens: number;
    costPer1kTokens: number;
}

export interface ModelAgreement {
    modelAgreements: Record<string, boolean>;
}

export interface CodeExample {
    code: string;
    language: string;
}

export interface ReviewFinding {
    title: string;
    description: string;
    category: ReviewCategory;
    modelAgreement: ModelAgreement;
    codeExample?: CodeExample;
    recommendation?: string;
    isStrength: boolean;
}

export interface ModelInsight {
    model: ModelInfo;
    insight: string;
    details: string;
}

export interface CategoryAgreementAnalysis {
    area: string;
    highAgreement: string[];
    partialAgreement: string[];
    disagreement: string[];
}

export interface AgreementStatistics {
    category: string;
    allThreeModels: number;
    twoModels: number;
    oneModel: number;
}

export enum Priority {
    HIGH = 'High Priority',
    MEDIUM = 'Medium Priority',
    LOW = 'Low Priority',
}

export interface CodeReviewReport {
    projectName: string;
    reviewDate: string;
    categories: ReviewCategory[];
    models: ModelInfo[];
    modelMetrics: ModelMetrics[];
    keyStrengths: ReviewFinding[];
    keyAreasForImprovement: ReviewFinding[];
    findingsByCategory: Record<string, ReviewFinding[]>;
    modelInsights: ModelInsight[];
    agreementAnalysis: CategoryAgreementAnalysis[];
    agreementStatistics: AgreementStatistics[];
    prioritizedRecommendations: Record<Priority, string[]>;
}
