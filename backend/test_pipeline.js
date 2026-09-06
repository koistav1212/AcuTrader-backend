import './src/config/env.js';
import mongoose from 'mongoose';
import { config } from './src/config/env.js';
import researchService from './src/modules/research/research.service.js';

async function runTest() {
  if (config.mongoUri) {
    try {
      await mongoose.connect(config.mongoUri);
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('Failed to connect to MongoDB:', err.message);
    }
  }

  const symbol = 'AAPL';
  console.log(`Testing pipeline for ${symbol}...`);

  const startTime = Date.now();
  try {
    const result = await researchService.getResearchForSymbol(symbol, { forceML: true, audit: true });
    
    console.log('\n--- FINAL RESULT ---');
    console.log('Success:', result.success);
    console.log('Pipeline Status:', JSON.stringify(result.pipelineStatus, null, 2));
    
    const llmOutput = result.models?.llmSynthesis;
    if (llmOutput) {
      console.log('\n--- LLM Forecast ---');
      console.log('Day 1 populated:', !!llmOutput.forecast?.day_1);
      console.log('Day 2 populated:', !!llmOutput.forecast?.day_2);
      console.log('Day 3 populated:', !!llmOutput.forecast?.day_3);
      
      const p1 = llmOutput.forecast?.day_1?.probabilities;
      if (p1) {
        const sum = (p1.bull_case || 0) + (p1.neutral_case || 0) + (p1.bear_case || 0);
        console.log('Day 1 Probabilities sum to 1:', Math.abs(sum - 1.0) < 0.05, `(Sum: ${sum})`);
      }
      
      console.log('Day 1 Date:', llmOutput.forecast?.day_1?.date);
      console.log('Day 2 Date:', llmOutput.forecast?.day_2?.date);
      console.log('Day 3 Date:', llmOutput.forecast?.day_3?.date);
    }
    
    console.log(`\nTime taken: ${Date.now() - startTime}ms`);
  } catch (err) {
    console.error('Pipeline failed:', err);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
}

runTest();
