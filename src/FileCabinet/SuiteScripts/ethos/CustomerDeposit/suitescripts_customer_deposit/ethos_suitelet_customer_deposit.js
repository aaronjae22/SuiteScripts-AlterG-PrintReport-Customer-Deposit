/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/file', 'N/format', 'N/https', 'N/query', 'N/record', 'N/render', 'N/runtime'],
    /**
 * @param{file} file
 * @param{format} format
 * @param{https} https
 * @param{query} query
 * @param{record} record
 * @param{render} render
 * @param{runtime} runtime
 */
    (file, format, https, query, record, render, runtime) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {

            const depositData = getDepositInfo(scriptContext);

            log.debug({title: 'Deposit Data', details: depositData});

        }

        const getDepositInfo = (scriptContext) => {

            const params = scriptContext.request.parameters;

            log.debug({title: 'Params', details: params});

            const recId = params.transactionId;
            const recType = params.recordType;

            /* const scriptContextAttr = {
                params,
                recId,
                recType
            } */

            if (!recId || !recType)
                return ;

            if (!params.tpl)
                return ;

            const customerDeposit = record.load({id: recId, type: recType, isDynamic: true});
            // log.debug({title: 'Record', details: customerDeposit});

            // Getting Payment Events List Info from Netsuite //
            const paymentEventsListName = 'paymentevent';
            const lineCount = customerDeposit.getLineCount({sublistId: paymentEventsListName});

            // Getting Customer Deposit Primary Info //
            const customer = customerDeposit.getValue({fieldId: 'entityname'});
            // const salesOrder = customerDeposit.getValue({fieldId: 'salesorder'});
            const salesOrder = customerDeposit.getText({fieldId: 'salesorder'});
            const deposit = customerDeposit.getValue({fieldId: 'tranid'});
            const paymentAmount = customerDeposit.getValue({fieldId: 'payment'});
            const currency = customerDeposit.getValue({fieldId: 'currencyname'});
            // const transactionDate = customerDeposit.getValue({fieldId: 'trandate'});
            const transactionDate = format.format({type: format.Type.DATE, value: customerDeposit.getValue({fieldId: 'trandate'})});
            const postingPeriod = customerDeposit.getText({fieldId: 'postingperiod'});
            const account = customerDeposit.getValue({fieldId: 'account'});
            const memo = customerDeposit.getValue({fieldId: 'memo'});

            const depositData = {
                customer,
                salesOrder,
                deposit,
                paymentAmount,
                currency,
                transactionDate,
                postingPeriod,
                account,
                memo,
                paymentEvents: [],
            };

            // Getting Payment Events Info //
            for (let i = 0; i < lineCount; i++)
            {
                let eventRecord = {
                    transaction: customerDeposit.getSublistValue({
                        sublistId: paymentEventsListName,
                        fieldId: 'owningtransaction',
                        line: i}),
                    transactionDate: customerDeposit.getSublistValue({
                        sublistId: paymentEventsListName,
                        fieldId: 'eventdate',
                        line: i}),
                    tranEvent: customerDeposit.getSublistValue({
                        sublistId: paymentEventsListName,
                        fieldId: 'type',
                        line: i}),
                    tranHandling: customerDeposit.getSublistValue({
                        sublistId: paymentEventsListName,
                        fieldId: 'eventtype',
                        line: i}),
                    paymentOption: customerDeposit.getSublistValue({
                        sublistId: paymentEventsListName,
                        fieldId: 'card',
                        line: i}),
                    result: customerDeposit.getSublistValue({
                        sublistId: paymentEventsListName,
                        fieldId: 'result',
                        line: i}),
                    reason: customerDeposit.getSublistValue({
                        sublistId: paymentEventsListName,
                        fieldId: 'holdreason',
                        line: i}),
                    amount: customerDeposit.getSublistValue({
                        sublistId: paymentEventsListName,
                        fieldId: 'amount',
                        line: i})

                }

                // log.debug({title: 'Event Record', details: eventRecord});
                depositData.paymentEvents.push(eventRecord);
            }

            // log.debug({title: 'Deposit Data', details: depositData});
            return depositData;
        }

        return {onRequest}

    });
