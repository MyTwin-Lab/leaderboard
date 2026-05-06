import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

//diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG); 

export function setupOtel() {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!endpoint) {
    console.warn('[OTel] OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing disabled');
    return;
  }

  const headers: Record<string, string> = {};
  if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
    // Format: "key=value,key2=value2"
    for (const pair of process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',')) {
      const [key, ...rest] = pair.split('=');
      if (key && rest.length) {
        headers[key.trim()] = rest.join('=').trim();
      }
    }
  }

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers,
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      //[ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'my-app',
      [ATTR_SERVICE_NAME]: 'my-app',
      [ATTR_SERVICE_VERSION]: '1.0.0',
      'service.namespace': 'my-application-group',  
      'deployment.environment': 'production', 
    }),
    spanProcessor: new SimpleSpanProcessor(traceExporter),
    instrumentations: [
      new HttpInstrumentation(),
      new FetchInstrumentation(),
      new PgInstrumentation(),
    ],
  });

  sdk.start();

  console.log(`[OTel] Tracing enabled → ${endpoint}`);

  process.on('SIGTERM', () => {
    sdk.shutdown().catch(console.error);
  });
}
