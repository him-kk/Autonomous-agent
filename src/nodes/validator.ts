// ============================================
// Validator Node - Quality Assurance & Retry Logic
// ============================================

import { llmService } from '@/services/llm.js';
import { logger } from '@/utils/logger.js';
import { 
  AgentState, 
  CleanedItem, 
  ValidationResult, 
  ValidationRule,
  ValidationIssue 
} from '@/types/index.js';

export class ValidatorNode {
  private nodeName = 'ValidatorNode';

  async invoke(state: AgentState): Promise<Partial<AgentState>> {
    logger.info('ValidatorNode invoked', { 
      itemsToValidate: state.cleanedData.length 
    });

    const startTime = Date.now();
    const validationResults: ValidationResult[] = [];
    const urlsToRetry: string[] = [];

    try {
      state.status = 'validating';

      // Get validation rules based on entity type
      const rules = this.getValidationRules(state.query);

      // Validate each item
      for (const item of state.cleanedData) {
        const result = await this.validateItem(item, rules);
        validationResults.push(result);

        // Check if retry is needed
        if (!result.isValid && result.score < 50) {
          urlsToRetry.push(item.url);
        }
      }

      // Calculate overall score
      const overallScore = validationResults.reduce((acc, r) => acc + r.score, 0) / validationResults.length;
      const retryNeeded = urlsToRetry.length > 0 && overallScore < 70;

      logger.info('ValidatorNode completed', {
        totalValidated: validationResults.length,
        validItems: validationResults.filter(r => r.isValid).length,
        invalidItems: validationResults.filter(r => !r.isValid).length,
        overallScore,
        urlsToRetry: urlsToRetry.length,
        duration: Date.now() - startTime
      });

      return {
        validationResults,
        status: retryNeeded ? 'scraping' : 'analyzing'
      };
    } catch (error) {
      logger.error('ValidatorNode error:', error);
      state.errors.push({
        node: this.nodeName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        recoverable: true
      });
      throw error;
    }
  }

  private async validateItem(
    item: CleanedItem,
    rules: ValidationRule[]
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 100;

    // Apply each validation rule
    for (const rule of rules) {
      const issue = await this.applyRule(item, rule);
      if (issue) {
        issues.push(issue);
        
        // Deduct score based on severity
        const deductions = {
          low: 5,
          medium: 15,
          high: 30,
          critical: 50
        };
        score -= deductions[issue.severity];
      }
    }

    // Additional AI-based validation
    const aiValidation = await this.aiValidate(item);
    if (aiValidation.issues.length > 0) {
      issues.push(...aiValidation.issues);
      score -= aiValidation.scoreDeduction;
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    // Generate suggestions
    const suggestions = this.generateSuggestions(item, issues);

    return {
      itemId: item.id,
      isValid: score >= 70 && !issues.some(i => i.severity === 'critical'),
      score,
      issues,
      suggestions,
      validatedAt: new Date()
    };
  }

  private async applyRule(
    item: CleanedItem,
    rule: ValidationRule
  ): Promise<ValidationIssue | null> {
    const fields = item.structuredData.fields;
    const value = fields[rule.field];

    switch (rule.rule) {
      case 'required':
        if (value === null || value === undefined || value === '') {
          return {
            field: rule.field,
            issue: `Required field "${rule.field}" is missing`,
            severity: rule.severity
          };
        }
        break;

      case 'format':
        if (value && !this.validateFormat(value, rule.params)) {
          return {
            field: rule.field,
            issue: `Field "${rule.field}" has invalid format`,
            severity: rule.severity
          };
        }
        break;

      case 'range':
        if (value !== null && value !== undefined) {
          const numValue = Number(value);
          if (isNaN(numValue) || numValue < rule.params.min || numValue > rule.params.max) {
            return {
              field: rule.field,
              issue: `Field "${rule.field}" is outside valid range`,
              severity: rule.severity
            };
          }
        }
        break;

      case 'unique':
        // Unique check is done at batch level
        break;

      case 'custom':
        if (value && rule.params.validator && !rule.params.validator(value)) {
          return {
            field: rule.field,
            issue: `Field "${rule.field}" failed custom validation`,
            severity: rule.severity
          };
        }
        break;
    }

    return null;
  }

  private validateFormat(value: any, format: string): boolean {
    const formatPatterns: Record<string, RegExp> = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\/.+/,
      phone: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
      price: /^[\$\€\£\¥]?\s?\d+(?:,\d{3})*(?:\.\d{2})?$/
    };

    const pattern = formatPatterns[format];
    if (pattern) {
      return pattern.test(String(value));
    }

    return true;
  }

  private async aiValidate(item: CleanedItem): Promise<{ issues: ValidationIssue[]; scoreDeduction: number }> {
    const issues: ValidationIssue[] = [];
    let scoreDeduction = 0;

    try {
      const prompt = `Validate the following extracted data for quality and completeness:

URL: ${item.url}
Entity Type: ${item.structuredData.entityType}
Fields: ${JSON.stringify(item.structuredData.fields, null, 2)}
Raw Text Sample: ${item.structuredData.rawText.substring(0, 500)}

Check for:
1. Data consistency
2. Missing important fields
3. Suspicious or fake data
4. Data quality issues

Return a JSON array of issues found, each with:
- field: the field name (or "general")
- issue: description of the problem
- severity: "low", "medium", "high", or "critical"`;

      const response = await llmService.generateJSON<ValidationIssue[]>(prompt, {
        systemPrompt: 'You are a data quality validator. Identify issues in extracted web data.',
        temperature: 0.1
      });

      const aiIssues = response.content;
      
      for (const issue of aiIssues) {
        issues.push(issue);
        
        const deductions = {
          low: 3,
          medium: 8,
          high: 15,
          critical: 30
        };
        scoreDeduction += deductions[issue.severity] || 5;
      }
    } catch (error) {
      logger.warn('AI validation failed:', error);
    }

    return { issues, scoreDeduction };
  }

  private generateSuggestions(item: CleanedItem, issues: ValidationIssue[]): string[] {
    const suggestions: string[] = [];

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          suggestions.push(`Re-scrape ${issue.field} from source`);
          break;
        case 'high':
          suggestions.push(`Verify ${issue.field} with alternative source`);
          break;
        case 'medium':
          suggestions.push(`Cross-reference ${issue.field} for accuracy`);
          break;
        case 'low':
          suggestions.push(`Consider enriching ${issue.field} data`);
          break;
      }
    }

    // Add general suggestions
    if (item.confidence < 70) {
      suggestions.push('Consider using alternative extraction method');
    }

    if (Object.keys(item.structuredData.fields).length < 3) {
      suggestions.push('Expand data extraction to capture more fields');
    }

    return [...new Set(suggestions)];
  }

  private getValidationRules(query: string): ValidationRule[] {
    const entityType = this.detectEntityType(query);
    
    const baseRules: ValidationRule[] = [
      { field: 'title', rule: 'required', severity: 'medium' },
      { field: 'description', rule: 'required', severity: 'low' }
    ];

    const entityRules: Record<string, ValidationRule[]> = {
      business: [
        { field: 'name', rule: 'required', severity: 'critical' },
        { field: 'website', rule: 'format', params: 'url', severity: 'medium' },
        { field: 'email', rule: 'format', params: 'email', severity: 'low' },
        { field: 'phone', rule: 'format', params: 'phone', severity: 'low' }
      ],
      product: [
        { field: 'name', rule: 'required', severity: 'critical' },
        { field: 'price', rule: 'required', severity: 'high' },
        { field: 'price', rule: 'format', params: 'price', severity: 'medium' }
      ],
      service: [
        { field: 'name', rule: 'required', severity: 'critical' },
        { field: 'provider', rule: 'required', severity: 'high' },
        { field: 'price', rule: 'format', params: 'price', severity: 'low' }
      ],
      person: [
        { field: 'name', rule: 'required', severity: 'critical' },
        { field: 'email', rule: 'format', params: 'email', severity: 'medium' }
      ]
    };

    return [...baseRules, ...(entityRules[entityType] || [])];
  }

  private detectEntityType(query: string): string {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('agency') || queryLower.includes('company')) return 'business';
    if (queryLower.includes('product')) return 'product';
    if (queryLower.includes('service')) return 'service';
    if (queryLower.includes('person') || queryLower.includes('people')) return 'person';
    
    return 'general';
  }

  // Check for duplicates across the dataset
  async checkDuplicates(items: CleanedItem[]): Promise<ValidationResult[]> {
    const seen = new Map<string, string[]>();
    const duplicates = new Set<string>();

    // Group by key fields
    for (const item of items) {
      const fields = item.structuredData.fields;
      const key = `${fields.name}|${fields.website}|${fields.email}`.toLowerCase();
      
      if (seen.has(key)) {
        seen.get(key)!.push(item.id);
        duplicates.add(item.id);
        seen.get(key)!.forEach(id => duplicates.add(id));
      } else {
        seen.set(key, [item.id]);
      }
    }

    return items.map(item => {
      const isDuplicate = duplicates.has(item.id);
      return {
        itemId: item.id,
        isValid: !isDuplicate,
        score: isDuplicate ? 50 : 100,
        issues: isDuplicate ? [{
          field: 'general',
          issue: 'Duplicate entry detected',
          severity: 'high' as const
        }] : [],
        suggestions: isDuplicate ? ['Merge with existing entry or verify uniqueness'] : [],
        validatedAt: new Date()
      };
    });
  }
}

export const validatorNode = new ValidatorNode();
