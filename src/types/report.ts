export interface CliOptions {
    models?: string;
    ignore?: string;
    diff?: boolean;
    output?: string;
    failOnError?: boolean;
    summaryOnly?: boolean;
    tokenLimit?: number;
    reviewType?: string;
    include?: string;
    ignorePatterns?: string;
    style?: string;
    compress?: boolean;
    removeComments?: boolean;
    removeEmptyLines?: boolean;
    outputShowLineNumbers?: boolean;
    headerText?: string;
    instructionFilePath?: string;
    topFilesLen?: number;
    tokenCountEncoding?: string;
    skipApiKeyValidation?: boolean;
    enhancedReport?: boolean;
    task?: string;
    doc?: string[];
    verbose?: boolean;
    quiet?: boolean;
    version?: boolean;
}

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

export interface CodeExample {
    code: string;
    language: string;
}

export interface ReviewFinding {
    title: string;
    description: string;
    category: ReviewCategory;
    modelAgreements: Record<string, boolean>;
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
}

export interface ModelReviewResult {
    model: string;
    summary: string;
    review: string;
    metrics: {
        latency: number;
        tokenInput: number;
        tokenOutput: number;
        tokenTotal: number;
        cost: string;
        error?: string;
    };
    error: boolean;
}
