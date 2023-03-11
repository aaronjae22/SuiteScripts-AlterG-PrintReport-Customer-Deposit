/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/file', 'N/format', 'N/https', 'N/query', 'N/record', 'N/render', 'N/runtime'],

    (file, format, https, query, record, render, runtime) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {

            if (!scriptContext.request.method === https.Method.GET)
                return ;

            const depositData = getDepositInfo(scriptContext);

            log.debug({title: 'Deposit Data', details: depositData});

            return generateReport(scriptContext, depositData);

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

            const currentDate = new Date();
            const printedDate = format.format({type: format.Type.DATE, value: currentDate});

            // const transactionDate = customerDeposit.getValue({fieldId: 'trandate'});
            const transactionDate = format.format({type: format.Type.DATE, value: customerDeposit.getValue({fieldId: 'trandate'})});
            const postingPeriod = customerDeposit.getText({fieldId: 'postingperiod'});
            const account = customerDeposit.getValue({fieldId: 'account'});
            const memo = customerDeposit.getValue({fieldId: 'memo'});

            const subsidiary = customerDeposit.getText({fieldId: 'subsidiary'});
            const location = customerDeposit.getText({fieldId: 'location'});

            const depositData = {
                customer,
                salesOrder,
                deposit,
                paymentAmount,
                currency,
                printedDate,
                transactionDate,
                postingPeriod,
                account,
                memo,
                subsidiary,
                location,
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
                    /* transactionDate: customerDeposit.getSublistValue({
                        sublistId: paymentEventsListName,
                        fieldId: 'eventdate',
                        line: i}),*/
                    transactionDate: format.format({type: format.Type.DATE,
                        value: customerDeposit.getSublistValue({
                            sublistId : paymentEventsListName,
                            fieldId : 'eventdate',
                            line : i})}),
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


        const generateReport = (scriptContext, depositData) => {

            const reportPDFTemplate = '/SuiteScripts/ethos/CustomerDeposit/html_templates/customer_deposit_report.html';

            const renderer = render.create();

            const templateFile = file.load({id: reportPDFTemplate});

            // log.debug({title: 'Template File', details: templateFile});

            renderer.addCustomDataSource({
                alias: 'record',
                format: render.DataSource.OBJECT,
                data: depositData,
            });

            renderer.templateContent = templateFile.getContents();
            // log.debug({title: 'Renderer Template Content', details: renderer.templateContent});

            const pdfFile = renderer.renderAsPdf();
            // log.debug({title: 'PDF File', details: pdfFile});

            return scriptContext.response.writeFile(pdfFile, true);

        }

        return {onRequest}

    });
