import {consumeConversationBatch} from '../server/conversations-consumer.mjs';
export default {async queue(batch,env){await consumeConversationBatch(batch,env)}};
