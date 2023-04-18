use neon::prelude::*;

/// Function which takes user from room data and return separated values for each user as his: identifier and candidate data
fn split_candidates_list(mut cx: FunctionContext) -> JsResult<JsArray> {
    // Ok(cx.string("hello node"))
    let candidates_list = if let Ok(li) = cx.argument::<JsArray>(0) {
        li
    } else {
        return cx.throw_error("Argument 1 must be passed");
    };
    let cl_len = candidates_list.len(&mut cx);

    if cl_len == 0 {
        return cx.throw_error("Candidates list must not be empty");
    }

    // Store results of spliting
    let results_storage = JsArray::new(&mut cx, cl_len);
    let candidates = JsArray::new(&mut cx, cl_len);
    let user_ids = JsArray::new(&mut cx, cl_len);

    // Obtain all required stuff from passed by user input datas
    for itterated_id in 0..cl_len {
        // Obtain value from string
        let arg = candidates_list.get_value(&mut cx, itterated_id)?;
        let arg = arg
            .downcast::<JsString, FunctionContext>(&mut cx)
            .unwrap()
            .value(&mut cx);

        // Split and collect results
        let mut collection = arg.split(":").collect::<Vec<&str>>();
        let uuid = cx.string(collection.remove(0));
        let candidate = cx.string(collection.join(":"));

        // Add values obtained durning splitting process to returning JsArray
        candidates.set(&mut cx, itterated_id, candidate)?; // add obtained candidate value
        user_ids.set(&mut cx, itterated_id, uuid)?; // add obtained userid value
    }

    // Add fragment storages to result storage
    results_storage.set(&mut cx, 0, user_ids)?; // add user ids as first returning result array value
    results_storage.set(&mut cx, 1, candidates)?; // add candidates as second returning result array value

    // Return from function result array
    Ok(results_storage)
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("split_candidates", split_candidates_list)?;
    Ok(())
}
