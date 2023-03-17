/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/**
 * Customer Deposits: https://910658.app.netsuite.com/app/accounting/transactions/transactionlist.nl?Transaction_TYPE=CustDep&whence=
 * Suitelet Script Deployment: https://910658.app.netsuite.com/app/common/scripting/scriptrecord.nl?id=2974&whence=
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

            const depositData = getDepositRecord(scriptContext);

            log.debug({title: 'Deposit Data', details: depositData});

            return generateReport(scriptContext, depositData);

        }

        const getDepositRecord = (scriptContext) => {

            const params = scriptContext.request.parameters;

            // log.debug({title: 'Params', details: params});

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

            const depositData = getDepositData(scriptContext, customerDeposit);
            // log.debug({title: 'Deposit DATA', details: depositData});

            return depositData;
        }


        const getDepositData = (scriptContext, customerDeposit) => {

            // Getting Payment Events List Info from Netsuite //
            const paymentEventsListName = 'paymentevent';
            const lineCount = customerDeposit.getLineCount({sublistId: paymentEventsListName});

            // Getting Customer Deposit Primary Info //
            const customer = customerDeposit.getValue({fieldId: 'entityname'});
            const customerId = customerDeposit.getValue({fieldId: 'customer'});
            const salesOrderText = customerDeposit.getText({fieldId: 'salesorder'});
            const salesOrder = customerDeposit.getValue({fieldId: 'salesorder'});
            const deposit = customerDeposit.getValue({fieldId: 'tranid'});
            const paymentAmount = customerDeposit.getValue({fieldId: 'payment'});
            const currency = customerDeposit.getValue({fieldId: 'currencyname'});

            const currentDate = new Date();
            const printedDate = format.format({type: format.Type.DATE, value: currentDate});

            const transactionDate = format.format({type: format.Type.DATE, value: customerDeposit.getValue({fieldId: 'trandate'})});
            const postingPeriod = customerDeposit.getText({fieldId: 'postingperiod'});
            const account = customerDeposit.getText({fieldId: 'account'});
            const memo = customerDeposit.getValue({fieldId: 'memo'});

            const subsidiary = customerDeposit.getText({fieldId: 'subsidiary'});
            const location = customerDeposit.getText({fieldId: 'location'});

            /* const shipTo = customerDeposit.getText({fieldId: 'custbody_shipto_address'});
            const shipToSplit = shipTo.split('\n');
            log.debug({title: 'Ship Split Info', details: shipToSplit}); */

            // const shippingData = getShippingData(customerId)[0];
            // log.debug({title: 'Customer Shipping Data', details: shippingData});

            // LOAD SALES ORDER REC //
            const salesOrderRec = record.load({id: salesOrder, type: 'salesorder', isDynamic: true});
            log.debug({title: 'Sales Order Record', details: salesOrderRec});

            let shippingData = salesOrderRec.getValue({fieldId: 'shipaddress'}) || "";
            // shippingData = shippingData.split("\n");
            shippingData = shippingData.replaceAll("\n", "<br/>");
            log.debug({title: 'Shipping Data', details: shippingData});

            let billData = salesOrderRec.getValue({fieldId: 'billaddress'}) || "";
            // billData = billData.split("\n");
            billData = billData.replaceAll("\n", "<br/>");
            log.debug({title: 'Billing Data', details: billData});

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
                shippingData,
                billData,
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

        const getShippingData = (customerId) => {

            // let sql = `SELECT * FROM Customer WHERE id = ?`;

            let sql = `SELECT companyname as companyName,
                                custentity_territory_shipping_address_1 as shippingAddress1,
                                custentity_territory_shipping_address_2 as shippingAddress2,
                                custentity_territory_shipping_city as shippingCity,
                                custentity_territory_shipping_states as shippingState,
                                custentity_territory_shipping_zip as shippingZip,
                                custentity_territory_country as shippingCountry
                        FROM Customer
                        WHERE id = ?`;

            return query.runSuiteQL({query: sql, params: [customerId]}).asMappedResults();

        }

        return {onRequest}

    });

